const proxyServer = '/image-proxy?url='; // Replace with your actual proxy server URL

const extractFileName = (url, index) => {
    const fileNameWithParams = url.substring(url.lastIndexOf('/') + 1); // Get last part after "/"
    const cleanFileName = fileNameWithParams.split('?')[0]; // Remove query parameters
    return cleanFileName || `image_${index + 1}`; // Fallback if empty
};

/**
 * Handle multiple images for a content property.
 * @param {Array} value - The array of image objects (with `url` field).
 * @param {string} key - The property key being processed.
 * @param {Object} propertyDefinition - The property definition object.
 * @param checkImageExists
 * @param addFileToJcr
 * @param fullFilePath
 * @returns {Array} - Array of UUIDs of the images.
 */
export const handleMultipleImages = async (value, key, propertyDefinition, checkImageExists, addFileToJcr, baseFilePath, pathSuffix) => {
    if (!Array.isArray(value)) {
        console.warn(`Invalid format for multiple images on key ${key}.`);
        return null;
    }

    const uuids = [];

    for (const [index, item] of value.entries()) {
        try {
            const url = item.url?.trim();
            if (!url) {
                console.warn(`Image URL missing for item at index ${index}. Skipping.`);
                continue;
            }

            const fileName = extractFileName(url, 1);
            const imagePath = `${baseFilePath}/${pathSuffix}/${fileName}`;
            const {data} = await checkImageExists({variables: {path: imagePath}});

            const existingNode = data?.jcr?.nodeByPath;
            if (existingNode) {
                console.log(`Image exists: ${existingNode.name}. Using UUID: ${existingNode.uuid}`);
                uuids.push(existingNode.uuid);
                continue;
            }

            const proxiedUrl = `${proxyServer}${encodeURIComponent(url)}`;
            const binaryResponse = await fetch(proxiedUrl);

            if (!binaryResponse.ok) {
                console.warn(`Failed to fetch image at URL: ${url}. Response status: ${binaryResponse.status}`);
                continue;
            }

            const binaryBlob = await binaryResponse.blob();
            const mimeType = binaryBlob.type || 'application/octet-stream';
            const fileHandle = new File([binaryBlob], key, {type: mimeType});
            const uploadPath = `${baseFilePath}/${pathSuffix}`;

            const {data: uploadResponse} = await addFileToJcr({
                variables: {
                    nameInJCR: fileName,
                    path: uploadPath,
                    mimeType,
                    fileHandle
                }
            });

            if (uploadResponse?.jcr?.addNode?.uuid) {
                console.log(`Successfully uploaded image ${index + 1}. UUID: ${uploadResponse.jcr.addNode.uuid}`);
                uuids.push(uploadResponse.jcr.addNode.uuid);
            } else {
                console.warn(`Failed to get UUID for image ${index + 1} at URL: ${url}`);
            }
        } catch (error) {
            console.error(`Error processing image at index ${index}:`, error);
        }
    }

    return uuids;
};

/**
 * Handle multiple non-image values for a content property.
 * @param {Array} value - The array of values.
 * @param {string} key - The property key being processed.
 * @returns {Array} - Array of processed values.
 */
export const handleMultipleValues = async (value, key) => {
    if (!Array.isArray(value)) {
        console.warn(`Invalid format for multiple values on key ${key}.`);
        return null;
    }

    const processedValues = value.map(item => item.value?.trim()).filter(Boolean);

    if (processedValues.length === 0) {
        console.warn(`No valid values found for key ${key}.`);
    }

    return processedValues;
};

/**
 * Handle a single image for a content property.
 * @param {Object} value - The image object (with `url` field).
 * @param {string} key - The property key being processed.
 * @param checkImageExists
 * @param addFileToJcr
 * @param baseFilePath
 * @param pathSuffix
 * @returns {string} - UUID of the image.
 */
export const handleSingleImage = async (value, key, checkImageExists, addFileToJcr, baseFilePath, pathSuffix) => {
    try {
        const url = value.url?.trim();
        if (!url) {
            console.warn(`Image URL missing for key ${key}.`);
            return null;
        }

        const fileName = extractFileName(url, 1);
        const imagePath = `${baseFilePath}/${pathSuffix}/${fileName}`;
        const {data} = await checkImageExists({variables: {path: imagePath}});

        const existingNode = data?.jcr?.nodeByPath;
        if (existingNode) {
            console.log(`Image exists: ${existingNode.name}. Using UUID: ${existingNode.uuid}`);
            return existingNode.uuid;
        }

        const proxiedUrl = `${proxyServer}${encodeURIComponent(url)}`;
        const binaryResponse = await fetch(proxiedUrl);

        if (!binaryResponse.ok) {
            console.warn(`Failed to fetch image at URL: ${url}. Response status: ${binaryResponse.status}`);
            return null;
        }

        const binaryBlob = await binaryResponse.blob();
        const mimeType = binaryBlob.type || 'application/octet-stream';
        const fileHandle = new File([binaryBlob], key, {type: mimeType});
        const uploadPath = `${baseFilePath}/${pathSuffix}`;

        const {data: uploadResponse} = await addFileToJcr({
            variables: {
                nameInJCR: fileName,
                path: uploadPath,
                mimeType,
                fileHandle
            }
        });

        if (uploadResponse?.jcr?.addNode?.uuid) {
            console.log(`Successfully uploaded image. UUID: ${uploadResponse.jcr.addNode.uuid}`);
            return uploadResponse.jcr.addNode.uuid;
        }

        console.warn(`Failed to get UUID for image at URL: ${url}`);
        return null;
    } catch (error) {
        console.error(`Error processing image for key ${key}:`, error);
        return null;
    }
};
