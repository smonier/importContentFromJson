package org.jahia.se.modules.jcrimport.servlet;

import org.apache.commons.io.IOUtils;
import org.jahia.bin.filters.AbstractServletFilter;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

@Component(service = AbstractServletFilter.class)
public class ImageProxyServlet extends AbstractServletFilter {

    private static final Logger logger = LoggerFactory.getLogger(ImageProxyServlet.class);

    @Activate
    public void activate(Map<String, String> config) {
        logger.info("Activated ImageProxyServlet with /image-proxy/");
        setUrlPatterns(new String[]{"/image-proxy/*"});
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

        String method = request.getMethod();
        logger.info("Received {} request to URL: {}", method, request.getRequestURL());

        if ("GET".equalsIgnoreCase(method)) {
            handleRequest(request, response);
        } else {
            logger.warn("Unsupported HTTP method: {}", method);
            response.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED, "Method not supported");
        }
    }

    private void handleRequest(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String targetUrl = request.getParameter("url"); // Get the target URL from the request parameter
        if (targetUrl == null || targetUrl.isEmpty()) {
            logger.error("Missing 'url' query parameter");
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing 'url' query parameter");
            return;
        }

        logger.info("Proxying request to URL: {}", targetUrl);

        HttpURLConnection connection = null;
        try {
            connection = createConnection(new URL(targetUrl));

            // Stream the response directly to the client
            response.setStatus(connection.getResponseCode());
            response.setContentType(connection.getContentType());
            response.setContentLength(connection.getContentLength());

            try (InputStream inputStream = connection.getInputStream()) {
                IOUtils.copy(inputStream, response.getOutputStream());
            }

            logger.info("Successfully proxied response from URL: {}", targetUrl);
        } catch (IOException e) {
            logger.error("Error while proxying request", e);
            response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Error while proxying request");
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private HttpURLConnection createConnection(URL url) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Accept", "image/*"); // Specify image content type
        connection.setRequestProperty("Accept-Language", "en");
        return connection;
    }
}