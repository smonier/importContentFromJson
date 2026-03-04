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
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

@Component(service = AbstractServletFilter.class)
public class LocalFileProxyServlet extends AbstractServletFilter {

    private static final Logger logger = LoggerFactory.getLogger(LocalFileProxyServlet.class);

    @Activate
    public void activate(Map<String, String> config) {
        logger.info("Activated LocalFileProxyServlet with /local-file-proxy/");
        setUrlPatterns(new String[]{"/local-file-proxy/*"});
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
        String filePath = request.getParameter("path");
        if (filePath == null || filePath.isEmpty()) {
            logger.error("Missing 'path' query parameter");
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing 'path' query parameter");
            return;
        }

        // Security: Remove file:// prefix if present
        if (filePath.startsWith("file://")) {
            filePath = filePath.substring(7);
        }

        // Security: Prevent path traversal attacks
        Path normalizedPath = Paths.get(filePath).normalize();
        if (normalizedPath.toString().contains("..")) {
            logger.error("Path traversal attempt detected: {}", filePath);
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Invalid file path");
            return;
        }

        File file = normalizedPath.toFile();
        
        if (!file.exists()) {
            logger.error("File not found: {}", filePath);
            response.sendError(HttpServletResponse.SC_NOT_FOUND, "File not found");
            return;
        }

        if (!file.isFile()) {
            logger.error("Path is not a file: {}", filePath);
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Path is not a file");
            return;
        }

        if (!file.canRead()) {
            logger.error("File not readable: {}", filePath);
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "File not readable");
            return;
        }

        logger.info("Reading local file: {}", file.getAbsolutePath());

        try {
            // Detect MIME type
            String mimeType = Files.probeContentType(normalizedPath);
            if (mimeType == null) {
                mimeType = "application/octet-stream";
            }

            response.setStatus(HttpServletResponse.SC_OK);
            response.setContentType(mimeType);
            response.setContentLength((int) file.length());

            try (InputStream inputStream = new FileInputStream(file)) {
                IOUtils.copy(inputStream, response.getOutputStream());
            }

            logger.info("Successfully served file: {}", file.getAbsolutePath());
        } catch (IOException e) {
            logger.error("Error while reading file", e);
            response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Error while reading file");
        }
    }
}
