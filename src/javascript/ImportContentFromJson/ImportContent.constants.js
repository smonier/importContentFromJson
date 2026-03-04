/**
 * Constants for ImportContent module - Production configuration
 */

// File upload limits
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_ITEMS_PER_IMPORT = 1000; // Maximum items to process in single import
export const BATCH_SIZE = 50; // Process items in batches

// Validation patterns
export const VALID_NODE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const VALID_PATH_SEGMENT_PATTERN = /^[a-zA-Z0-9_\-/]+$/;
export const MAX_NODE_NAME_LENGTH = 255;
export const MAX_PATH_LENGTH = 2048;

// Allowed file types
export const ALLOWED_FILE_TYPES = {
    JSON: ['application/json', 'text/json'],
    CSV: ['text/csv', 'application/vnd.ms-excel', 'text/plain']
};

// File extensions
export const ALLOWED_EXTENSIONS = ['.json', '.csv'];

// Image configuration
export const MAX_IMAGE_URL_LENGTH = 2048;
export const ALLOWED_IMAGE_PROTOCOLS = ['http:', 'https:'];
export const IMAGE_FETCH_TIMEOUT = 30000; // 30 seconds

// Rate limiting
export const API_CALL_DELAY = 100; // Ms between API calls
export const MAX_CONCURRENT_REQUESTS = 5;

// Error messages
export const ERROR_MESSAGES = {
    FILE_TOO_LARGE: 'File size exceeds maximum allowed size of',
    INVALID_FILE_TYPE: 'Invalid file type. Only JSON and CSV files are allowed.',
    INVALID_JSON: 'Invalid JSON format. Please check the file contents.',
    INVALID_CSV: 'Invalid CSV format. Please check the file contents.',
    TOO_MANY_ITEMS: 'Too many items to import. Maximum allowed is',
    INVALID_PATH: 'Invalid path. Path can only contain alphanumeric characters, hyphens, underscores, and forward slashes.',
    INVALID_NODE_NAME: 'Invalid node name. Node name can only contain alphanumeric characters, hyphens, and underscores.',
    PATH_TOO_LONG: 'Path is too long. Maximum length is',
    NODE_NAME_TOO_LONG: 'Node name is too long. Maximum length is',
    INVALID_IMAGE_URL: 'Invalid image URL. Only HTTP and HTTPS protocols are allowed.',
    IMAGE_URL_TOO_LONG: 'Image URL is too long. Maximum length is',
    NO_CONTENT_TYPE: 'Please select a content type.',
    NO_FILE_UPLOADED: 'Please upload a file.',
    NETWORK_ERROR: 'Network error occurred. Please try again.',
    PERMISSION_DENIED: 'Permission denied. Please check your access rights.',
    UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.'
};

// Logging configuration
export const ENABLE_DEBUG_LOGGING = process.env.NODE_ENV === 'development';
export const LOG_LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
};
