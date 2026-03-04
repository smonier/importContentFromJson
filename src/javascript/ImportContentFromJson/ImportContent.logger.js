/**
 * Secure logging utility for production environments
 * Prevents sensitive data from being logged in production
 */

import {ENABLE_DEBUG_LOGGING} from './ImportContent.constants';

/**
 * Sanitize data before logging to remove sensitive information
 * @param {*} data - Data to sanitize
 * @returns {*} Sanitized data
 */
const sanitizeLogData = data => {
    if (!data) {
        return data;
    }

    if (typeof data === 'string') {
        // Mask potential sensitive patterns
        return data
            .replace(/password["\s:=]+[^&\s"]*/gi, 'password=***')
            .replace(/token["\s:=]+[^&\s"]*/gi, 'token=***')
            .replace(/api[_-]?key["\s:=]+[^&\s"]*/gi, 'apiKey=***')
            .replace(/bearer\s+[^\s]+/gi, 'bearer ***');
    }

    if (typeof data === 'object') {
        const sanitized = Array.isArray(data) ? [] : {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                // Skip sensitive keys
                if (/password|token|secret|key|auth/i.test(key)) {
                    sanitized[key] = '***';
                } else {
                    sanitized[key] = sanitizeLogData(data[key]);
                }
            }
        }

        return sanitized;
    }

    return data;
};

/**
 * Logger class with environment-aware logging
 */
class Logger {
    constructor() {
        this.isProduction = process.env.NODE_ENV === 'production';
        this.enableDebug = ENABLE_DEBUG_LOGGING;
    }

    /**
     * Log error message
     * @param {string} message - Error message
     * @param {*} data - Additional data
     */
    error(message, data = null) {
        const sanitizedData = data ? sanitizeLogData(data) : null;
        if (sanitizedData) {
            console.error(`[ImportContent ERROR] ${message}`, sanitizedData);
        } else {
            console.error(`[ImportContent ERROR] ${message}`);
        }
    }

    /**
     * Log warning message
     * @param {string} message - Warning message
     * @param {*} data - Additional data
     */
    warn(message, data = null) {
        const sanitizedData = data ? sanitizeLogData(data) : null;
        if (sanitizedData) {
            console.warn(`[ImportContent WARN] ${message}`, sanitizedData);
        } else {
            console.warn(`[ImportContent WARN] ${message}`);
        }
    }

    /**
     * Log info message
     * @param {string} message - Info message
     * @param {*} data - Additional data
     */
    info(message, data = null) {
        if (this.isProduction) {
            return; // Don't log info in production
        }

        const sanitizedData = data ? sanitizeLogData(data) : null;
        if (sanitizedData) {
            console.info(`[ImportContent INFO] ${message}`, sanitizedData);
        } else {
            console.info(`[ImportContent INFO] ${message}`);
        }
    }

    /**
     * Log debug message
     * @param {string} message - Debug message
     * @param {*} data - Additional data
     */
    debug(message, data = null) {
        if (!this.enableDebug) {
            return;
        }

        const sanitizedData = data ? sanitizeLogData(data) : null;
        if (sanitizedData) {
            console.debug(`[ImportContent DEBUG] ${message}`, sanitizedData);
        } else {
            console.debug(`[ImportContent DEBUG] ${message}`);
        }
    }

    /**
     * Start a log group
     * @param {string} label - Group label
     */
    group(label) {
        if (!this.isProduction && this.enableDebug) {
            console.group(label);
        }
    }

    /**
     * End log group
     */
    groupEnd() {
        if (!this.isProduction && this.enableDebug) {
            console.groupEnd();
        }
    }
}

// Export singleton instance
export default new Logger();
