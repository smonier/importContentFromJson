package org.jahia.se.modules.jcrimport.servlet;

import org.apache.commons.io.IOUtils;
import org.jahia.bin.filters.AbstractServletFilter;
import org.jahia.services.content.JCRSessionFactory;
import org.jahia.services.usermanager.JahiaUser;
import org.jahia.services.usermanager.JahiaUserManagerService;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Modified;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Streams a remote image back to an authenticated back-office user, avoiding
 * browser CORS restrictions.
 *
 * <p>Security model (defends against SSRF):</p>
 * <ul>
 *     <li>Only authenticated (non-guest) Jahia users may call this endpoint.</li>
 *     <li>Only {@code http}/{@code https} URLs are accepted.</li>
 *     <li>The target host is resolved and requests to loopback, link-local,
 *         site-local (private) and any-local addresses are rejected — this blocks
 *         access to {@code localhost}, internal services and cloud metadata
 *         endpoints (e.g. 169.254.169.254).</li>
 *     <li>An optional {@code imageProxy.allowedHosts} allow-list can restrict the
 *         proxy to specific hosts.</li>
 *     <li>Redirects are not followed automatically (a redirect could point at an
 *         internal address that bypasses the pre-flight check).</li>
 * </ul>
 */
@Component(service = AbstractServletFilter.class, configurationPid = "org.jahia.se.modules.importContentFromJson")
public class ImageProxyServlet extends AbstractServletFilter {

    private static final Logger logger = LoggerFactory.getLogger(ImageProxyServlet.class);

    private static final int CONNECT_TIMEOUT_MS = 10000;
    private static final int READ_TIMEOUT_MS = 30000;

    private volatile Set<String> allowedHosts = new HashSet<>();

    @Activate
    @Modified
    public void activate(Map<String, String> config) {
        this.allowedHosts = parseAllowedHosts(config == null ? null : config.get("imageProxy.allowedHosts"));
        logger.info("Activated ImageProxyServlet with /image-proxy/ ({})",
                allowedHosts.isEmpty() ? "any public host" : allowedHosts.size() + " allowed host(s)");
        setUrlPatterns(new String[]{"/image-proxy/*"});
    }

    private static Set<String> parseAllowedHosts(String raw) {
        Set<String> hosts = new HashSet<>();
        if (raw == null || raw.trim().isEmpty()) {
            return hosts;
        }

        Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(h -> !h.isEmpty())
                .map(h -> h.toLowerCase(Locale.ROOT))
                .forEach(hosts::add);
        return hosts;
    }

    @Override
    public void init(FilterConfig filterConfig) {
        logger.debug("Initializing ImageProxyServlet");
    }

    @Override
    public void destroy() {
        logger.debug("Destroying ImageProxyServlet");
    }

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain) throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) servletRequest;
        HttpServletResponse response = (HttpServletResponse) servletResponse;

        if (!isAuthenticated()) {
            logger.warn("Rejected unauthenticated request to image-proxy");
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Authentication required");
            return;
        }

        String method = request.getMethod();
        if ("GET".equalsIgnoreCase(method)) {
            handleRequest(request, response);
        } else {
            logger.warn("Unsupported HTTP method: {}", method);
            response.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED, "Method not supported");
        }
    }

    private boolean isAuthenticated() {
        JahiaUser user = JCRSessionFactory.getInstance().getCurrentUser();
        return user != null && !JahiaUserManagerService.GUEST_USERNAME.equals(user.getUsername());
    }

    private void handleRequest(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String targetUrl = request.getParameter("url");
        if (targetUrl == null || targetUrl.isEmpty()) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing 'url' query parameter");
            return;
        }

        final URL url;
        try {
            url = new URL(targetUrl);
        } catch (MalformedURLException e) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid URL");
            return;
        }

        if (!isSafeTarget(url)) {
            logger.warn("Rejected image-proxy request to disallowed target");
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Target URL is not allowed");
            return;
        }

        logger.debug("Proxying image request to an allowed host");

        HttpURLConnection connection = null;
        try {
            connection = createConnection(url);
            int status = connection.getResponseCode();

            // Do not follow redirects server-side: a 3xx Location could point at
            // an internal address and bypass the pre-flight SSRF check.
            if (status >= 300 && status < 400) {
                response.sendError(HttpServletResponse.SC_BAD_GATEWAY, "Redirects are not supported");
                return;
            }

            response.setStatus(status);
            if (connection.getContentType() != null) {
                response.setContentType(connection.getContentType());
            }

            if (connection.getContentLengthLong() >= 0) {
                response.setContentLengthLong(connection.getContentLengthLong());
            }

            try (InputStream inputStream = connection.getInputStream()) {
                IOUtils.copy(inputStream, response.getOutputStream());
            }

            logger.debug("Successfully proxied image response");
        } catch (IOException e) {
            logger.error("Error while proxying request", e);
            response.sendError(HttpServletResponse.SC_BAD_GATEWAY, "Error while proxying request");
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private boolean isSafeTarget(URL url) {
        String protocol = url.getProtocol() == null ? "" : url.getProtocol().toLowerCase(Locale.ROOT);
        if (!"http".equals(protocol) && !"https".equals(protocol)) {
            return false;
        }

        String host = url.getHost();
        if (host == null || host.isEmpty()) {
            return false;
        }

        if (!allowedHosts.isEmpty() && !allowedHosts.contains(host.toLowerCase(Locale.ROOT))) {
            return false;
        }

        // Resolve and reject internal / metadata addresses.
        try {
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (address.isLoopbackAddress()
                        || address.isAnyLocalAddress()
                        || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress()
                        || address.isMulticastAddress()) {
                    return false;
                }
            }
        } catch (UnknownHostException e) {
            return false;
        }

        return true;
    }

    private HttpURLConnection createConnection(URL url) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        connection.setRequestProperty("Accept", "image/*");
        connection.setRequestProperty("Accept-Language", "en");
        return connection;
    }
}
