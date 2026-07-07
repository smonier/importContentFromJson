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
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Streams a local server file back to an authenticated back-office user.
 *
 * <p>Security model:</p>
 * <ul>
 *     <li>Only authenticated (non-guest) Jahia users may call this endpoint.</li>
 *     <li>The requested path is normalized and must resolve <em>inside</em> one of the
 *         directories configured via {@code localFileProxy.allowedRoots}. With no roots
 *         configured the servlet fails closed and serves nothing.</li>
 *     <li>Error responses never echo absolute server paths (avoids filesystem disclosure).</li>
 * </ul>
 */
@Component(service = AbstractServletFilter.class, configurationPid = "org.jahia.se.modules.importContentFromJson")
public class LocalFileProxyServlet extends AbstractServletFilter {

    private static final Logger logger = LoggerFactory.getLogger(LocalFileProxyServlet.class);

    private volatile List<Path> allowedRoots = new ArrayList<>();

    @Activate
    @Modified
    public void activate(Map<String, String> config) {
        this.allowedRoots = parseAllowedRoots(config == null ? null : config.get("localFileProxy.allowedRoots"));
        logger.info("Activated LocalFileProxyServlet with /local-file-proxy ({} allowed root(s))", allowedRoots.size());
        setUrlPatterns(new String[]{"/local-file-proxy", "/local-file-proxy/*"});
    }

    private static List<Path> parseAllowedRoots(String raw) {
        List<Path> roots = new ArrayList<>();
        if (raw == null || raw.trim().isEmpty()) {
            return roots;
        }

        for (String entry : raw.split(",")) {
            String trimmed = entry.trim();
            if (!trimmed.isEmpty()) {
                roots.add(Paths.get(trimmed).toAbsolutePath().normalize());
            }
        }

        return roots;
    }

    @Override
    public void init(FilterConfig filterConfig) {
        logger.debug("Initializing LocalFileProxyServlet");
    }

    @Override
    public void destroy() {
        logger.debug("Destroying LocalFileProxyServlet");
    }

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain) throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) servletRequest;
        HttpServletResponse response = (HttpServletResponse) servletResponse;

        if (!isAuthenticated()) {
            logger.warn("Rejected unauthenticated request to local-file-proxy");
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
        String filePath = request.getParameter("path");
        if (filePath == null || filePath.isEmpty()) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing 'path' query parameter");
            return;
        }

        // Remove file:// prefix if present
        if (filePath.startsWith("file://")) {
            filePath = filePath.substring(7);
        }

        if (allowedRoots.isEmpty()) {
            logger.warn("local-file-proxy called but no allowed roots are configured (localFileProxy.allowedRoots); denying");
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Local file access is not enabled");
            return;
        }

        Path normalizedPath = Paths.get(filePath).toAbsolutePath().normalize();

        // Confinement: the resolved path must live inside a configured root.
        if (!isWithinAllowedRoot(normalizedPath)) {
            logger.warn("Rejected local-file-proxy request outside allowed roots");
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Invalid file path");
            return;
        }

        File file = normalizedPath.toFile();

        if (!file.exists() || !file.isFile()) {
            // Do not disclose absolute server paths in the response body.
            response.sendError(HttpServletResponse.SC_NOT_FOUND, "File not found");
            return;
        }

        if (!file.canRead()) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "File not readable");
            return;
        }

        try {
            String mimeType = Files.probeContentType(normalizedPath);
            if (mimeType == null) {
                mimeType = "application/octet-stream";
            }

            response.setStatus(HttpServletResponse.SC_OK);
            response.setContentType(mimeType);
            response.setContentLengthLong(file.length());

            try (InputStream inputStream = new FileInputStream(file)) {
                IOUtils.copy(inputStream, response.getOutputStream());
            }

            logger.debug("Served local file within allowed root");
        } catch (IOException e) {
            logger.error("Error while reading file", e);
            response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Error while reading file");
        }
    }

    private boolean isWithinAllowedRoot(Path candidate) {
        for (Path root : allowedRoots) {
            if (candidate.startsWith(root)) {
                return true;
            }
        }

        return false;
    }
}
