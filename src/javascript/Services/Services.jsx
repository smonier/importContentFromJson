import {createApi} from 'unsplash-js';

const proxyServer = '/image-proxy?url='; // Replace with your actual proxy server URL

const extractFileName = (url, index) => {
    const fileNameWithParams = url.substring(url.lastIndexOf('/') + 1); // Get last part after "/"
    const cleanFileName = fileNameWithParams.split('?')[0]; // Remove query parameters
    return cleanFileName || `image_${index + 1}`; // Fallback if empty
};

const fetchUnsplashImages = async (query, perPage = 10) => {
    try {
        const unsplash = getUnsplashClient();
        if (!unsplash) {
            return [];
        }

        if (!query || typeof query !== 'string') {
            console.error('Invalid query for Unsplash API.');
            return [];
        }

        const response = await unsplash.search.getPhotos({query, perPage});

        if (!response || response.errors) {
            console.error('Unsplash API Error:', response.errors || 'Unknown error');
            return [];
        }

        if (!response.response || !Array.isArray(response.response.results)) {
            console.warn('Unexpected response structure from Unsplash API.');
            return [];
        }

        return response.response.results
            .map(photo => ({
                url: photo.urls?.regular || '', // Fallback to empty string if missing
                description: photo.description || photo.alt_description || 'No description',
                photographer: photo.user?.name || 'Unknown',
                profileUrl: photo.user?.links?.html || '#'
            }))
            .filter(image => image.url !== ''); // Ensure only valid URLs are returned
    } catch (error) {
        console.error('Error fetching images from Unsplash:', error);
        return [];
    }
};

export const handleMultipleImages = async (value, key, propertyDefinition, checkImageExists, addFileToJcr, baseFilePath, pathSuffix) => {
    if (typeof value === 'string') {
        value = value.split(/[;,]/).map(v => v.trim()).filter(Boolean);
    }

    if (!Array.isArray(value)) {
        console.warn(`Invalid format for multiple images on key ${key}.`);
        return [];
    }

    let imageList = value.map(item => (typeof item === 'string' ? {url: item} : item));
    // If (value.length === 1 && value[0].url === 'unsplash') {
    //     imageList = await fetchUnsplashImages(propertyDefinition.query, 2);
    // }

    const results = [];

    for (const [index, item] of imageList.entries()) {
        let url = item.url?.trim();
        if (url === 'unsplash') {
            const unsplashImages = await fetchUnsplashImages(item.query, 1);
            if (unsplashImages.length > 0) {
                url = unsplashImages[0].url;
            } else {
                console.warn('No Unsplash images found. Skipping.');
                continue;
            }
        }

        if (!url) {
            console.warn(`Image URL missing for item at index ${index}. Skipping.`);
            continue;
        }

        try {
            const fileName = extractFileName(url, index);
            const imagePath = `${baseFilePath}/${pathSuffix}/${fileName}`;
            const {data} = await checkImageExists({variables: {path: imagePath}});
            const existingNode = data?.jcr?.nodeByPath;
            if (existingNode) {
                console.log(`Image exists: ${existingNode.name}. Using UUID: ${existingNode.uuid}`);
                results.push({uuid: existingNode.uuid, status: 'already exists', name: fileName});
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
                results.push({uuid: uploadResponse.jcr.addNode.uuid, status: 'created', name: fileName});
            } else {
                console.warn(`Failed to get UUID for image ${index + 1} at URL: ${url}`);
                results.push({uuid: null, status: 'failed', name: fileName});
            }
        } catch (error) {
            console.error(`Error processing image at index ${index}:`, error);
            results.push({uuid: null, status: 'failed', name: fileName});
        }
    }

    return results;
};

export const handleSingleImage = async (value, key, checkImageExists, addFileToJcr, baseFilePath, pathSuffix) => {
    try {
        let url = typeof value === 'string' ? value.trim() : value.url?.trim();
        if (url === 'unsplash') {
            const unsplashImages = await fetchUnsplashImages(value.query, 1);
            if (unsplashImages.length > 0) {
                url = unsplashImages[0].url;
            } else {
                console.warn('No Unsplash images found. Skipping.');
                return {uuid: null, status: 'failed', name: ''};
            }
        }

        if (!url) {
            console.warn(`Image URL missing for key ${key}.`);
            return {uuid: null, status: 'failed', name: ''};
        }

        const fileName = extractFileName(url, 1);
        const imagePath = `${baseFilePath}/${pathSuffix}/${fileName}`;
        const {data} = await checkImageExists({variables: {path: imagePath}});

        const existingNode = data?.jcr?.nodeByPath;
        if (existingNode) {
            console.log(`Image exists: ${existingNode.name}. Using UUID: ${existingNode.uuid}`);
            return {uuid: existingNode.uuid, status: 'already exists', name: fileName};
        }

        const proxiedUrl = `${proxyServer}${encodeURIComponent(url)}`;
        const binaryResponse = await fetch(proxiedUrl);

        if (!binaryResponse.ok) {
            console.warn(`Failed to fetch image at URL: ${url}. Response status: ${binaryResponse.status}`);
            return {uuid: null, status: 'failed', name: fileName};
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
            return {uuid: uploadResponse.jcr.addNode.uuid, status: 'created', name: fileName};
        }

        console.warn(`Failed to get UUID for image at URL: ${url}`);
        return {uuid: null, status: 'failed', name: fileName};
    } catch (error) {
        console.error(`Error processing image for key ${key}:`, error);
        return {uuid: null, status: 'failed', name: ''};
    }
};

/**
 * Handle multiple non-image values for a content property.
 * @param {Array} value - The array of values.
 * @param {string} key - The property key being processed.
 * @returns {Array} - Array of processed values.
 */
export const handleMultipleValues = (value, key) => {
    if (!Array.isArray(value)) {
        console.warn(`Invalid format for multiple values on key ${key}.`, value);
        return null;
    }

    const processedValues = value
        .map(item => {
            if (typeof item === 'string') {
                return item.trim();
            }

            if (typeof item === 'object' && typeof item.value === 'string') {
                return item.value.trim();
            }

            return null;
        })
        .filter(Boolean);

    if (processedValues.length === 0) {
        console.warn(`No valid values found for key ${key}.`, value);
    }

    return processedValues;
};

export const getUnsplashClient = () => {
    const accessKey = window?.contextJsParameters?.config?.unsplashConfig?.accessKey;
    if (!accessKey) {
        console.error('Unsplash accessKey is missing or undefined.');
        return null;
    }

    return createApi({accessKey, fetch});
};
