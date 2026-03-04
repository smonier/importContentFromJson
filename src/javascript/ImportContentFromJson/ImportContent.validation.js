/**
 * Validation and sanitization utilities for ImportContent
 * These functions ensure data security and integrity
 */

import {
    MAX_FILE_SIZE,
    MAX_ITEMS_PER_IMPORT,
    VALID_NODE_NAME_PATTERN,
    VALID_PATH_SEGMENT_PATTERN,
    MAX_NODE_NAME_LENGTH,
    MAX_PATH_LENGTH,
    ALLOWED_FILE_TYPES,
    ALLOWED_EXTENSIONS,
    MAX_IMAGE_URL_LENGTH,
    ALLOWED_IMAGE_PROTOCOLS,
    ERROR_MESSAGES
} from './ImportContent.constants';

/**
 * Validate file upload
 * @param {File} file - File object to validate
 * @returns {{valid: boolean, error: string|null}} Validation result
 */
export const validateFile = file => {
    if (!file) {
        return {valid: false, error: ERROR_MESSAGES.NO_FILE_UPLOADED};
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `${ERROR_MESSAGES.FILE_TOO_LARGE} ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB`
        };
    }

    // Check file extension
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
        return {valid: false, error: ERROR_MESSAGES.INVALID_FILE_TYPE};
    }

    // Check MIME type
    const isValidType = Object.values(ALLOWED_FILE_TYPES).some(types =>
        types.includes(file.type)
    );

    if (!isValidType && file.type !== '') {
        return {valid: false, error: ERROR_MESSAGES.INVALID_FILE_TYPE};
    }

    return {valid: true, error: null};
};

/**
 * Sanitize node name to make it JCR-compatible
 * @param {string} name - Original name
 * @returns {string} Sanitized name
 */
export const sanitizeNodeName = name => {
    if (!name || typeof name !== 'string') {
        return `content_${Date.now()}`;
    }

    return String(name)
        .normalize('NFD') // Split accents from letters
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-zA-Z0-9\s_-]/g, '') // Remove invalid characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_+/g, '_') // Replace multiple underscores with single
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
        .toLowerCase()
        .substring(0, MAX_NODE_NAME_LENGTH) || `content_${Date.now()}`;
};

/**
 * Validate node name
 * @param {string} name - Node name to validate
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateNodeName = name => {
    if (!name || typeof name !== 'string') {
        return {valid: false, error: ERROR_MESSAGES.INVALID_NODE_NAME};
    }

    if (name.length > MAX_NODE_NAME_LENGTH) {
        return {
            valid: false,
            error: `${ERROR_MESSAGES.NODE_NAME_TOO_LONG} ${MAX_NODE_NAME_LENGTH} characters`
        };
    }

    if (!VALID_NODE_NAME_PATTERN.test(name)) {
        return {valid: false, error: ERROR_MESSAGES.INVALID_NODE_NAME};
    }

    return {valid: true, error: null};
};

/**
 * Validate path
 * @param {string} path - Path to validate
 * @returns {{valid: boolean, error: string|null}}
 */
export const validatePath = path => {
    if (!path) {
        return {valid: true, error: null}; // Empty path is valid (uses default)
    }

    if (typeof path !== 'string') {
        return {valid: false, error: ERROR_MESSAGES.INVALID_PATH};
    }

    if (path.length > MAX_PATH_LENGTH) {
        return {
            valid: false,
            error: `${ERROR_MESSAGES.PATH_TOO_LONG} ${MAX_PATH_LENGTH} characters`
        };
    }

    // Check for valid path characters
    if (!VALID_PATH_SEGMENT_PATTERN.test(path)) {
        return {valid: false, error: ERROR_MESSAGES.INVALID_PATH};
    }

    // Check for path traversal attempts
    if (path.includes('..') || path.includes('./') || path.includes('//')) {
        return {valid: false, error: ERROR_MESSAGES.INVALID_PATH};
    }

    return {valid: true, error: null};
};

/**
 * Sanitize path
 * @param {string} path - Path to sanitize
 * @returns {string} Sanitized path
 */
export const sanitizePath = path => {
    if (!path || typeof path !== 'string') {
        return '';
    }

    return path
        .replace(/\\/g, '/') // Replace backslashes
        .replace(/\/+/g, '/') // Replace multiple slashes
        .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
        .split('/') // Split into segments
        .map(segment => sanitizeNodeName(segment)) // Sanitize each segment
        .filter(Boolean) // Remove empty segments
        .join('/');
};

/**
 * Validate image URL
 * @param {string} url - URL to validate
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateImageUrl = url => {
    if (!url || typeof url !== 'string') {
        return {valid: false, error: ERROR_MESSAGES.INVALID_IMAGE_URL};
    }

    if (url.length > MAX_IMAGE_URL_LENGTH) {
        return {
            valid: false,
            error: `${ERROR_MESSAGES.IMAGE_URL_TOO_LONG} ${MAX_IMAGE_URL_LENGTH} characters`
        };
    }

    try {
        const urlObj = new URL(url);

        // Check protocol
        if (!ALLOWED_IMAGE_PROTOCOLS.includes(urlObj.protocol)) {
            return {valid: false, error: ERROR_MESSAGES.INVALID_IMAGE_URL};
        }

        // Check for obvious malicious patterns
        const lowerUrl = url.toLowerCase();
        // eslint-disable-next-line no-script-url
        if (lowerUrl.includes('<script') || lowerUrl.includes('javascript:') || lowerUrl.includes('data:')) {
            return {valid: false, error: ERROR_MESSAGES.INVALID_IMAGE_URL};
        }

        return {valid: true, error: null};
    } catch (_) {
        return {valid: false, error: ERROR_MESSAGES.INVALID_IMAGE_URL};
    }
};

/**
 * Validate array size
 * @param {Array} array - Array to validate
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateArraySize = array => {
    if (!Array.isArray(array)) {
        return {valid: false, error: 'Data must be an array'};
    }

    if (array.length > MAX_ITEMS_PER_IMPORT) {
        return {
            valid: false,
            error: `${ERROR_MESSAGES.TOO_MANY_ITEMS} ${MAX_ITEMS_PER_IMPORT}`
        };
    }

    return {valid: true, error: null};
};

/**
 * Sanitize string to prevent XSS
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeString = str => {
    if (!str || typeof str !== 'string') {
        return '';
    }

    return str
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};

/**
 * Validate JSON structure
 * @param {string} jsonString - JSON string to validate
 * @returns {{valid: boolean, data: any, error: string|null}}
 */
export const validateJSON = jsonString => {
    try {
        const data = JSON.parse(jsonString);
        return {valid: true, data, error: null};
    } catch (_) {
        return {valid: false, data: null, error: ERROR_MESSAGES.INVALID_JSON};
    }
};
