import React, {useEffect, useState} from 'react';
import {useLazyQuery, useMutation} from '@apollo/client';
import {
    GetContentTypeQuery,
    GetContentPropertiesQuery,
    CheckPathQuery,
    CreatePathMutation,
    CreateContentMutation,
    CreateFileMutation,
    CheckImageExists
} from './ImportContent.gql-queries.js';
import {Button, Header, Dropdown, Typography, Input} from '@jahia/moonstone';
import styles from './ImportContent.component.scss';
import {useTranslation} from 'react-i18next';
import {extractAndFormatContentTypeData} from '~/ImportContentFromJson/ImportContent.utils';

export default () => {
    const {t} = useTranslation('importContentFromJson');
    const [selectedContentType, setSelectedContentType] = useState(null);
    const [selectedProperties, setSelectedProperties] = useState([]);
    const [contentTypes, setContentTypes] = useState([]);
    const [properties, setProperties] = useState([]);
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [uploadedFileSample, setUploadedFileSample] = useState(null); // JSON sample
    const [uploadedFileContent, setUploadedFileContent] = useState(null); // Full JSON content
    const siteKey = window.contextJsParameters.siteKey;
    const [pathSuffix, setPathSuffix] = useState(''); // Editable suffix for the base path

    const language = window.contextJsParameters.uilang;
    const basePath = `/sites/${siteKey}/contents`; // Fixed base path

    // GraphQL Queries and Mutations
    const [fetchContentTypes, {data: contentTypeData}] = useLazyQuery(GetContentTypeQuery, {
        variables: {siteKey, language},
        fetchPolicy: 'network-only',
    });

    const [fetchProperties, {data: propertiesData}] = useLazyQuery(GetContentPropertiesQuery, {
        fetchPolicy: 'network-only',
    });

    const [checkPath] = useLazyQuery(CheckPathQuery, {fetchPolicy: 'network-only'});
    const [createPath] = useMutation(CreatePathMutation);
    const [createContent] = useMutation(CreateContentMutation);
    const [addFileToJcr] = useMutation(CreateFileMutation);
    const [checkImageExists, {data: imageExistsData}] = useLazyQuery(CheckImageExists);

    useEffect(() => {
        fetchContentTypes();
    }, [fetchContentTypes]);

    useEffect(() => {
        if (contentTypeData?.jcr?.nodeTypes?.nodes) {
            const contentTypeDataFormated = extractAndFormatContentTypeData(contentTypeData);
            setContentTypes(contentTypeDataFormated);
        }
    }, [contentTypeData]);

    useEffect(() => {
        if (propertiesData?.jcr?.nodeTypes?.nodes?.[0]?.properties) {
            setProperties(propertiesData.jcr.nodeTypes.nodes[0].properties);
        }
    }, [propertiesData]);

    const handleContentTypeChange = (selectedType) => {
        setSelectedContentType(selectedType);
        setSelectedProperties([]); // Clear selected properties when content type changes
        fetchProperties({variables: {type: selectedType, language}});
    };

    const handleFileUpload = (file) => {
        // Clear previous file state
        setUploadedFileName("");
        setUploadedFileContent(null);
        setUploadedFileSample(null);

        if (!file) {
            console.error("No file selected");
            return;
        }

        if (file.type !== "application/json") {
            console.error("Invalid file type. Please upload a JSON file.");
            alert("Invalid file type. Please upload a JSON file.");
            return;
        }

        setUploadedFileName(file.name); // Set the new file name

        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const jsonData = JSON.parse(event.target.result);
                setUploadedFileContent(jsonData); // Store full JSON content

                // Store the first 5 entries as a sample
                const sample = Array.isArray(jsonData)
                    ? jsonData.slice(0, 5)
                    : Object.entries(jsonData).slice(0, 5);

                setUploadedFileSample(sample); // Update the sample
            } catch (error) {
                console.error("Error parsing JSON file:", error);
                alert("Invalid JSON file. Please check the file contents.");
            }
        };

        reader.onerror = () => {
            console.error("Error reading file");
            alert("Error reading file. Please try again.");
        };

        reader.readAsText(file); // Read the content of the new file
    };

    const handleImport = async () => {
        const fullPath = `${basePath}/${pathSuffix.trim()}`;
        const errorReport = []; // Array to keep track of skipped nodes or errors
        let successCount = 0; // Counter for successfully created nodes

        try {
            // Step 1: Ensure the folder exists
            const {data: pathCheckData} = await checkPath({variables: {path: fullPath}});
            if (!pathCheckData?.jcr?.nodeByPath) {
                console.log("Path does not exist. Creating...");
                await createPath({variables: {path: basePath, name: pathSuffix, nodeType: "jnt:contentFolder"}});
                console.log("Folder created successfully.");
            } else {
                console.log("Path exists.");
            }

            const baseFilePath = `/sites/${siteKey}/files`;
            const fileSuffix = "importedFiles";
            const fullFilePath = `${baseFilePath}/${fileSuffix.trim()}`;

            const {data: pathCheckFile} = await checkPath({variables: {path: fullFilePath}});
            if (!pathCheckFile?.jcr?.nodeByPath) {
                console.log("Files Path does not exist. Creating...");
                await createPath({variables: {path: baseFilePath, name: fileSuffix, nodeType: "jnt:folder"}});
                console.log("Files Folder created successfully.");
            } else {
                console.log("Files Path exists.");
            }

            // Step 2: Validate JSON keys against the node type properties
            if (!uploadedFileContent || !selectedContentType) {
                alert("Please upload a valid JSON file and select a content type.");
                return;
            }

            const propertyDefinitions = properties; // These come from the `GetContentPropertiesQuery`

            // Step 3: Import nodes
            // Step 3: Import nodes
            for (const entry of uploadedFileContent) {
                const propertiesToSend = await Promise.all(
                    Object.keys(entry).map(async (key) => {
                        const propertyDefinition = propertyDefinitions.find(
                            (prop) => prop.name === key
                        );

                        if (!propertyDefinition) {
                            console.warn(`Property ${key} does not match the content type definition.`);
                            return null;
                        }

                        let value = entry[key];

                        // Handle DATE properties
                        if (propertyDefinition.requiredType === "DATE" && value) {
                            const date = new Date(value);
                            if (!isNaN(date.getTime())) {
                                value = date.toISOString(); // Convert to 'YYYY-MM-DDTHH:mm:ss.sssZ'
                            } else {
                                console.warn(`Invalid date format for property ${key}: ${value}`);
                            }
                        }

                        // Handle binary properties (e.g., images)
                        if (propertyDefinition.constraints?.includes("{http://www.jahia.org/jahia/mix/1.0}image") && value) {
                            try {
                                const proxyServer = "/image-proxy?url="; // Replace with your actual proxy server URL

                                // Check if the property is multiple
                                if (propertyDefinition.multiple) {
                                    // Split the value into an array of URLs
                                    const urls = value.split(",").map((url) => url.trim());
                                    const uuids = [];

                                    for (const [index, url] of urls.entries()) {
                                        try {
                                            // Extract the file name from the URL
                                            const fileName = url.substring(url.lastIndexOf("/") + 1) || `image_${index + 1}`;
                                            console.log(`Extracted file name: ${fileName}`);
                                            const imagePath = `/sites/${siteKey}/files/importedFiles/${fileName}`;
                                            const {data} = await checkImageExists({variables: {path: imagePath}});

                                            const existingNode = data?.jcr?.nodeByPath;
                                            if (existingNode) {
                                                    // Use the UUID of the jcr:content node
                                                    console.log(
                                                        `Image exists: ${existingNode.name}. Using jcr:content UUID: ${existingNode.uuid}`);

                                                    uuids.push(existingNode.uuid);
                                                    continue; // Skip to the next URL since the image exists
                                            }

                                            const proxiedUrl = `${proxyServer}${encodeURIComponent(url)}`;
                                            console.log(`Processing image ${index + 1}: ${proxiedUrl}`);
                                            const binaryResponse = await fetch(proxiedUrl);

                                            if (!binaryResponse.ok) {
                                                console.warn(`Failed to fetch image ${index + 1} at URL: ${url}. Response status: ${binaryResponse.status}`);
                                                continue;
                                            }

                                            const binaryBlob = await binaryResponse.blob();
                                            const mimeType = binaryBlob.type || "application/octet-stream";
                                            const fileHandle = new File([binaryBlob], key, {type: mimeType});
                                            const uploadPath = `/sites/${siteKey}/files/importedFiles`;

                                            const {data: uploadResponse} = await addFileToJcr({
                                                variables: {
                                                    nameInJCR: fileName, // Generate a unique name for the file
                                                    path: uploadPath,
                                                    mimeType: mimeType,
                                                    fileHandle: fileHandle,
                                                },
                                            });

                                            if (uploadResponse?.jcr?.addNode?.uuid) {
                                                console.log(`Successfully uploaded image ${index + 1}. UUID: ${uploadResponse.jcr.addNode.uuid}`);
                                                uuids.push(uploadResponse.jcr.addNode.uuid);
                                            } else {
                                                console.warn(`Failed to get UUID for image ${index + 1} at URL: ${url}`);
                                            }
                                        } catch (error) {
                                            console.error(`Error processing image ${index + 1}: ${url}`, error);
                                        }
                                    }

                                    value = uuids; // Set the value as an array of UUIDs
                                } else {
                                    // Single image handling
                                    // Extract the file name from the URL
                                    const fileName = value.substring(value.lastIndexOf("/") + 1) || `image_${index + 1}`;
                                    console.log(`Extracted file name: ${fileName}`);
                                    const imagePath = `/sites/${siteKey}/files/importedFiles/${fileName}`;

                                    const {data} = await checkImageExists({variables: {path: imagePath}});

                                    const existingNode = data?.jcr?.nodeByPath;
                                    if (existingNode) {
                                        // Use the UUID of the jcr:content node
                                        console.log(
                                            `Image exists: ${existingNode.name}. Using jcr:content UUID: ${existingNode.uuid}`);

                                        value = existingNode.uuid;
                                    } else {

                                        const proxiedUrl = `${proxyServer}${encodeURIComponent(value)}`;
                                        const binaryResponse = await fetch(proxiedUrl);

                                        if (!binaryResponse.ok) {
                                            console.warn(`Failed to fetch binary content for ${key}: ${value}`);
                                            return null;
                                        }

                                        const binaryBlob = await binaryResponse.blob();
                                        const mimeType = binaryBlob.type || "application/octet-stream";
                                        const fileHandle = new File([binaryBlob], key, {type: mimeType});
                                        const uploadPath = `/sites/${siteKey}/files/importedFiles`;

                                        // Use the addFileToJcr mutation to upload the file and get the UUID
                                        const {data: uploadResponse} = await addFileToJcr({
                                            variables: {
                                                nameInJCR: fileName, // Generate a unique name for the file
                                                path: uploadPath,
                                                mimeType: mimeType,
                                                fileHandle: fileHandle,
                                            },
                                        });

                                        if (uploadResponse?.jcr?.addNode?.uuid) {
                                            value = uploadResponse.jcr.addNode.uuid; // Use the UUID for the property
                                        } else {
                                            console.warn(`Failed to get UUID for binary content ${key}: ${value}`);
                                            return null;
                                        }
                                    }
                                }
                            } catch (error) {
                                console.error(`Error uploading binary content for ${key}: ${value}`, error);
                                return null;
                            }
                        }

                        // Return structure based on "multiple" flag
                        return propertyDefinition.multiple
                            ? {
                                name: key,
                                values: value, // Use 'values' for arrays
                                language: propertyDefinition?.internationalized ? language : undefined,
                            }
                            : {
                                name: key,
                                value: value, // Use 'value' for single values
                                language: propertyDefinition?.internationalized ? language : undefined,
                            };
                    })
                ).then((results) => results.filter(Boolean)); // Filter out invalid properties

                const contentName = entry["jcr:title"]
                    ? entry["jcr:title"].replace(/\s+/g, "_").toLowerCase()
                    : entry.name
                        ? entry.name.replace(/\s+/g, "_").toLowerCase()
                        : `content_${new Date().getTime()}`;

                try {
                    await createContent({
                        variables: {
                            path: fullPath,
                            name: contentName,
                            primaryNodeType: selectedContentType, // Use your custom node type
                            properties: propertiesToSend,
                        },
                    });
                    console.log(`Node created: ${fullPath}/${contentName}`);
                    successCount++; // Increment the success counter
                } catch (error) {
                    if (
                        error.message.includes("javax.jcr.ItemExistsException") ||
                        error.message.includes("This node already exists")
                    ) {
                        console.warn(`Node already exists: ${fullPath}/${contentName}`);
                        errorReport.push({
                            node: `${fullPath}/${contentName}`,
                            reason: "Node already exists",
                        });
                    } else {
                        console.error(`Error creating node: ${fullPath}/${contentName}`, error);
                        errorReport.push({
                            node: `${fullPath}/${contentName}`,
                            reason: "Other error",
                            details: error.message,
                        });
                    }
                }
            }

            // Step 4: Report success and errors
            if (errorReport.length > 0) {
                console.warn("Import completed with some issues:");
                console.table(errorReport);
                alert(
                    `Import completed with some issues. ${successCount} nodes were successfully created. Check the console for details.`
                );
            } else {
                console.log("Import completed successfully without errors!");
                alert(`${successCount} nodes were successfully created!`);
            }
        } catch (error) {
            console.error("Error during import:", error);
            alert("An error occurred during the import process.");
        }
    };

    return (
        <>
            <Header
                title={t('label.header', {siteInfo: siteKey})}
                mainActions={[
                    <Button
                        key="importButton"
                        size="big"
                        id="importButton"
                        color="accent"
                        isDisabled={!selectedContentType || !uploadedFileContent}
                        label={t('label.importFromJson')}
                        onClick={handleImport}
                    />
                ]}
            />
            <div className={styles.container}>
                <div className={styles.leftPanel}>
                    <Typography variant="heading" className={styles.heading}>
                        {t('label.path')}
                    </Typography>
                    <div className={styles.pathContainer}>
                        <Typography variant="body" className={styles.basePath}>
                            {basePath}/
                        </Typography>
                        <Input
                            value={pathSuffix}
                            onChange={(e) => setPathSuffix(e.target.value)}
                            placeholder={t('label.enterPathSuffix')}
                            className={styles.pathSuffixInput}
                        />
                    </div>

                    <Typography variant="heading" className={styles.heading}>
                        {t('label.selectContentType')}
                    </Typography>
                    <Dropdown
                        data={contentTypes}
                        icon={contentTypes && contentTypes.iconStart}
                        label={contentTypes && contentTypes.label}
                        value={selectedContentType}
                        className={styles.customDropdown}
                        placeholder={t('label.selectPlaceholder')}
                        onChange={(e, item) => handleContentTypeChange(item.value)}
                    />
                    <div className={styles.propertiesInfo}>
                        <Typography variant="heading" className={styles.heading}>
                            {t('label.properties')}
                        </Typography>
                        <div className={styles.propertiesList}>
                            {properties.map((property) => (
                                <div key={property.name} className={styles.propertyItem}>
                                    <Typography variant="body" className={styles.propertyText}>
                                        {property.displayName} - ({property.name} - {property.requiredType})
                                    </Typography>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={styles.rightPanel}>
                    <Typography variant="heading" className={styles.heading}>
                        {t('label.uploadFile')}
                    </Typography>
                    <div className={styles.fileUpload}>
                        <input
                            type="file"
                            id="fileUpload"
                            className={styles.fileInput}
                            onChange={(e) => handleFileUpload(e.target.files[0])}
                        />
                        <label htmlFor="fileUpload" className={styles.fileLabel}>
                            {uploadedFileName || t('label.chooseFile')}
                        </label>
                    </div>
                    {uploadedFileSample && (
                        <div className={styles.sampleContainer}>
                            <Typography variant="heading" className={styles.sampleHeading}>
                                {t('label.sampleData')}
                            </Typography>
                            <pre className={styles.sampleContent}>
                                {JSON.stringify(uploadedFileSample, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};