/**
 * Utility helpers for ImportContent component.
 * Functions here are logic only and contain no React code.
 */

/**
 * Ensure that a repository path exists by creating any missing segments.
 * @param {string} fullPath The full path to check or create.
 * @param {string} nodeType The JCR node type for intermediate folders.
 * @param {Function} checkPath GraphQL lazy query function to check if a path exists.
 * @param {Function} createPath GraphQL mutation to create a folder.
 */
export const ensurePathExists = async (fullPath, nodeType, checkPath, createPath) => {
    const pathSegments = fullPath.split('/').filter(segment => segment.length > 0);
    let currentPath = '';

    for (const segment of pathSegments) {
        currentPath += `/${segment}`;
        // eslint-disable-next-line no-await-in-loop
        const {data: pathCheckData} = await checkPath({variables: {path: currentPath}});
        if (!pathCheckData?.jcr?.nodeByPath) {
            const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
            const name = segment;
            // eslint-disable-next-line no-await-in-loop
            await createPath({variables: {path: parentPath, name, nodeType}});
        }
    }
};

/**
 * Check if a node already exists at the given path.
 *
 * @param {string} fullPath Full JCR path of the node to check.
 * @param {Function} checkPath GraphQL lazy query function to check the path.
 * @returns {{exists: boolean, uuid: string|null}} Result with existence flag and node UUID if found.
 */
export const nodeExists = async (fullPath, checkPath) => {
    try {
        const {data} = await checkPath({variables: {path: fullPath}});
        const node = data?.jcr?.nodeByPath;
        return {exists: Boolean(node), uuid: node?.uuid || null};
    } catch (_) {
        // In case of any error just assume the node does not exist
        return {exists: false, uuid: null};
    }
};

/**
 * Recursively flatten a category tree into a Map for fast lookup.
 * @param {Array} nodes Category nodes to flatten.
 * @param {Map} cache Map instance used to store name => uuid pairs.
 */
export const flattenCategoryTree = (nodes, cache) => {
    for (const node of nodes) {
        cache.set(node.name, node.uuid);
        if (node.children?.nodes.length > 0) {
            flattenCategoryTree(node.children.nodes, cache);
        }
    }
};

/**
 * Recursively extract all property paths from a JSON object.
 * Nested objects are returned using dot notation (e.g. "properties.subtitle").
 * @param {Object} obj Source object to inspect.
 * @param {string} prefix Current path prefix.
 * @returns {Array<string>} Flattened property paths.
 */
export const extractFileFields = (obj, prefix = '') => {
    if (!obj || typeof obj !== 'object') {
        return [];
    }

    return Object.keys(obj).flatMap(key => {
        const value = obj[key];
        const path = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return extractFileFields(value, path);
        }

        return [path];
    });
};

/**
 * Safely retrieve a nested value from an object using dot notation.
 * @param {Object} obj Source object.
 * @param {string} path Dot-notated path (e.g. "properties.subtitle").
 * @returns {*} Value found at the path or undefined.
 */
export const getValueByPath = (obj, path) => {
    return path.split('.').reduce((acc, part) => (acc !== undefined && acc !== null ? acc[part] : undefined), obj);
};

/**
 * Build preview data according to field mappings and available properties.
 * @param {Array|Object} uploadedFileContent Parsed JSON or CSV rows.
 * @param {Object} fieldMappings Mapping between JCR properties and file fields.
 * @param {Array} properties Definitions of the selected content type properties.
 * @returns {Array} Array of mapped entries ready for import.
 */
export const generatePreviewData = (uploadedFileContent, fieldMappings, properties, extraFields = []) => {
    if (!uploadedFileContent) {
        return [];
    }

    return uploadedFileContent.map(rawEntry => {
        const mappedEntry = {};
        Object.entries(fieldMappings).forEach(([propName, fileField]) => {
            if (!fileField) {
                return;
            }

            const valueFromFile = getValueByPath(rawEntry, fileField);
            if (valueFromFile === undefined) {
                return;
            }

            let value = valueFromFile;
            const propertyDefinition = properties.find(prop => prop.name === propName);
            const isImage = propertyDefinition?.constraints?.includes('{http://www.jahia.org/jahia/mix/1.0}image');
            const isMultiple = propertyDefinition?.multiple;

            if (isImage) {
                if (isMultiple) {
                    if (typeof value === 'string') {
                        value = value.split(/[;,]/).map(v => v.trim()).filter(Boolean);
                    }

                    if (Array.isArray(value)) {
                        value = value.map(v => (typeof v === 'string' ? {url: v} : v));
                    }
                } else if (typeof value === 'string') {
                    value = {url: value};
                }
            } else if (isMultiple) {
                if (typeof value === 'string') {
                    const trimmed = value.trim();
                    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                        try {
                            value = JSON.parse(trimmed);
                        } catch (_) {
                            value = trimmed.slice(1, -1).split(/[;,]/).map(v => v.trim()).filter(Boolean);
                        }
                    } else {
                        value = value.split(/[;,]/).map(v => v.trim()).filter(Boolean);
                    }
                } else if (value !== undefined && value !== null) {
                    value = Array.isArray(value) ? value : [value];
                } else {
                    value = [];
                }
            }

            mappedEntry[propName] = value;
        });

        extraFields.forEach(field => {
            const mappedField = fieldMappings[field];

            if (mappedField === null) {
                mappedEntry[field] = [];
                return;
            }

            const sourceKey = mappedField || field;
            let value = getValueByPath(rawEntry, sourceKey);

            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    try {
                        value = JSON.parse(trimmed);
                    } catch (_) {
                        value = trimmed.slice(1, -1).split(/[;,]/).map(v => v.trim()).filter(Boolean);
                    }
                } else {
                    value = value.split(/[;,]/).map(v => v.trim()).filter(Boolean);
                }
            }

            if (Array.isArray(value)) {
                mappedEntry[field] = value;
            } else if (value !== undefined && value !== null) {
                mappedEntry[field] = [value];
            } else {
                mappedEntry[field] = [];
            }
        });

        // Ensure tag and category arrays exist even if not mapped
        if (!Array.isArray(mappedEntry['j:tagList'])) {
            mappedEntry['j:tagList'] = [];
        }

        if (!Array.isArray(mappedEntry['j:defaultCategory'])) {
            mappedEntry['j:defaultCategory'] = [];
        }

        return mappedEntry;
    });
};
