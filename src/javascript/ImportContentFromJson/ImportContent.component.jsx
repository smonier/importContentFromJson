import React, {useEffect, useState, useRef} from 'react';
import Papa from 'papaparse/papaparse.min.js';
import {useLazyQuery, useMutation} from '@apollo/client';
import {
    GetContentTypeQuery,
    GetContentPropertiesQuery,
    CheckPathQuery,
    CreatePathMutation,
    CreateContentMutation,
    CheckImageExists,
    CreateFileMutation,
    AddTags,
    CheckIfCategoryExists,
    AddCategories,
    AddVanityUrl
} from '~/gql-queries/ImportContent.gql-queries';
import {handleMultipleImages, handleMultipleValues, handleSingleImage} from '~/Services/Services';

import {Button, Header, Dropdown, Typography, Input} from '@jahia/moonstone';

import {LoaderOverlay} from '~/DesignSystem/LoaderOverlay';
import styles from './ImportContent.component.scss';
import FieldMapping from './FieldMapping.jsx';
import {useTranslation} from 'react-i18next';
import {extractAndFormatContentTypeData} from '~/ImportContentFromJson/ImportContent.utils';

export default () => {
    const {t} = useTranslation('importContentFromJson');
    const [isLoading, setIsLoading] = useState(false); // Loading state
    const [selectedContentType, setSelectedContentType] = useState(null);
    const [selectedProperties, setSelectedProperties] = useState([]);
    const [contentTypes, setContentTypes] = useState([]);
    const [properties, setProperties] = useState([]);
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [uploadedFileSample, setUploadedFileSample] = useState(null); // JSON sample
    const [uploadedFileContent, setUploadedFileContent] = useState(null); // Full JSON content
    const [fileFields, setFileFields] = useState([]);
    const [fieldMappings, setFieldMappings] = useState({});
    const siteKey = window.contextJsParameters.siteKey;
    const [pathSuffix, setPathSuffix] = useState(''); // Editable suffix for the base path
    const [categoryTree, setCategoryTree] = useState(null);

    const language = window.contextJsParameters.uilang;
    const baseContentPath = `/sites/${siteKey}/contents`; // Fixed base path
    const baseFilePath = `/sites/${siteKey}/files`;

    // GraphQL Queries and Mutations
    const [fetchContentTypes, {data: contentTypeData}] = useLazyQuery(GetContentTypeQuery, {
        variables: {siteKey, language},
        fetchPolicy: 'network-only'
    });

    const [fetchProperties, {data: propertiesData}] = useLazyQuery(GetContentPropertiesQuery, {
        fetchPolicy: 'network-only'
    });

    const [fetchCategories, {data: categoryData}] = useLazyQuery(CheckIfCategoryExists, {
        fetchPolicy: 'network-only', // Ensures we get fresh data once
        onCompleted: data => {
            if (data?.jcr?.nodeByPath?.children?.nodes) {
                setCategoryTree(data.jcr.nodeByPath.children.nodes);
            }
        }
    });

    const [checkPath] = useLazyQuery(CheckPathQuery, {fetchPolicy: 'network-only'});
    const [createPath] = useMutation(CreatePathMutation);
    const [createContent] = useMutation(CreateContentMutation);
    const [checkImageExists] = useLazyQuery(CheckImageExists);
    const [addFileToJcr] = useMutation(CreateFileMutation);
    const [addTags] = useMutation(AddTags);
    const [checkIfCategoryExists] = useLazyQuery(CheckIfCategoryExists);
    const [addCategories] = useMutation(AddCategories);
    const [addVanityUrl] = useMutation(AddVanityUrl);

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

    useEffect(() => {
        if (properties.length > 0 && fileFields.length > 0) {
            setFieldMappings(prev => {
                const mapping = {...prev};
                properties.forEach(prop => {
                    if (fileFields.includes(prop.name) && !mapping[prop.name]) {
                        mapping[prop.name] = prop.name;
                    }
                });
                return mapping;
            });
        }
    }, [properties, fileFields]);

    const categoryCache = useRef(new Map()); // Store categories as { name: uuid }

    const fetchCategoriesOnce = async () => {
        if (categoryCache.current.size > 0) {
            return;
        } // Already fetched

        const {data, error} = await checkIfCategoryExists();
        if (error) {
            console.error('GraphQL Category Fetch Error:', error);
            return;
        }

        if (data?.jcr?.nodeByPath?.children?.nodes) {
            console.log('Category Tree Loaded:', data.jcr.nodeByPath.children.nodes);
            flattenCategoryTree(data.jcr.nodeByPath.children.nodes, categoryCache.current);
        }
    };

    // Recursive function to flatten category tree into a Map for fast lookup
    const flattenCategoryTree = (nodes, cache) => {
        for (const node of nodes) {
            cache.set(node.name, node.uuid);
            if (node.children?.nodes.length > 0) {
                flattenCategoryTree(node.children.nodes, cache);
            }
        }
    };

    const handleContentTypeChange = selectedType => {
        setSelectedContentType(selectedType);
        setSelectedProperties([]); // Clear selected properties when content type changes
        fetchProperties({variables: {type: selectedType, language}});
    };

    const handleFileUpload = file => {
        // Clear previous file state
        setUploadedFileName('');
        setUploadedFileContent(null);
        setUploadedFileSample(null);

        if (!file) {
            console.error('No file selected');
            return;
        }

        const isJson = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
        const isCsv = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.name.toLowerCase().endsWith('.csv');

        if (!isJson && !isCsv) {
            const invalidMsg = t('label.invalidFile');
            console.error(invalidMsg);
            alert(invalidMsg);
            return;
        }

        setUploadedFileName(file.name); // Set the new file name

        const reader = new FileReader();

        reader.onload = event => {
            try {
                if (isCsv) {
                    const result = Papa.parse(event.target.result, {header: true});
                    const rows = result.data;
                    setUploadedFileContent(rows);
                    setUploadedFileSample(rows.slice(0, 5));
                    setFileFields(result.meta?.fields || Object.keys(rows[0] || {}));
                } else {
                    const jsonData = JSON.parse(event.target.result);
                    setUploadedFileContent(jsonData); // Store full JSON content

                    const sample = Array.isArray(jsonData) ?
                        jsonData.slice(0, 5) :
                        Object.entries(jsonData).slice(0, 5);

                    setUploadedFileSample(sample); // Update the sample
                    const firstItem = Array.isArray(jsonData) ? jsonData[0] : jsonData;
                    setFileFields(Object.keys(firstItem || {}));
                }
            } catch (error) {
                console.error('Error parsing file:', error);
                alert('Invalid file. Please check the file contents.');
            }
        };

        reader.onerror = () => {
            console.error('Error reading file');
            alert('Error reading file. Please try again.');
        };

        reader.readAsText(file); // Read the content of the new file
    };

    const handleImport = async () => {
        setIsLoading(true);
        const fullContentPath = pathSuffix ? `${baseContentPath}/${pathSuffix.trim()}` : baseContentPath;
        const fullFilePath = pathSuffix ? `${baseFilePath}/${pathSuffix.trim()}` : baseFilePath;

        const errorReport = []; // Array to keep track of skipped nodes or errors
        let successCount = 0; // Counter for successfully created nodes

        try {
            // Step 1: Ensure the folder exists
            const ensurePathExists = async (fullPath, nodeType) => {
                const pathSegments = fullPath.split('/').filter(segment => segment.length > 0); // Remove empty segments
                let currentPath = '';

                for (const segment of pathSegments) {
                    currentPath += `/${segment}`;

                    // Check if the current path exists
                    // eslint-disable-next-line no-await-in-loop
                    const {data: pathCheckData} = await checkPath({variables: {path: currentPath}});
                    if (!pathCheckData?.jcr?.nodeByPath) {
                        console.log(`Path ${currentPath} does not exist. Creating...`);
                        const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
                        const name = segment;

                        // eslint-disable-next-line no-await-in-loop
                        await createPath({variables: {path: parentPath, name, nodeType}});
                        console.log(`Folder ${currentPath} created successfully.`);
                    }
                }
            };

            // Ensure the content path exists
            await ensurePathExists(fullContentPath, 'jnt:contentFolder');

            // Ensure the file path exists
            await ensurePathExists(fullFilePath, 'jnt:folder');

            // Step 2: Validate JSON keys against the node type properties
            if (!uploadedFileContent || !selectedContentType) {
                // eslint-disable-next-line no-alert
                alert('Please upload a valid JSON file and select a content type.');
                return;
            }

            const propertyDefinitions = properties; // These come from the `GetContentPropertiesQuery`

            for (const rawEntry of uploadedFileContent) {
                const mappedEntry = {};
                Object.entries(fieldMappings).forEach(([propName, fileField]) => {
                    if (rawEntry[fileField] !== undefined) {
                        mappedEntry[propName] = rawEntry[fileField];
                    }
                });

                if (rawEntry['j:tagList']) {
                    mappedEntry['j:tagList'] = rawEntry['j:tagList'];
                }

                if (rawEntry['j:defaultCategory']) {
                    mappedEntry['j:defaultCategory'] = rawEntry['j:defaultCategory'];
                }

                const propertiesToSend = await Promise.all(
                    Object.keys(mappedEntry).map(async key => {
                        // Skip j:tagList if not defined in the content type
                        if (key === 'j:tagList' || key === 'j:defaultCategory') {
                            console.info('Skipping j:tagList or j:defaultCategory property as it is not part of the content type definition.');
                            return null;
                        }

                        const propertyDefinition = propertyDefinitions.find(
                            prop => prop.name === key
                        );

                        if (!propertyDefinition) {
                            console.warn(`Property ${key} does not match the content type definition.`);
                            return null;
                        }

                        let value = mappedEntry[key];
                        // Handle tags (j:tagList)
                        if (key === 'j:tagList' && Array.isArray(value)) {
                            return null; // Skip tags for now; we'll handle them after creating the content.
                        }

                        const isImage = propertyDefinition.constraints?.includes('{http://www.jahia.org/jahia/mix/1.0}image');
                        const isDate = propertyDefinition.requiredType === 'DATE';
                        const isMultiple = propertyDefinition.multiple;

                        // Handle DATE properties
                        if (isDate && value) {
                            const date = new Date(value);
                            if (!isNaN(date.getTime())) {
                                value = date.toISOString(); // Convert to 'YYYY-MM-DDTHH:mm:ss.sssZ'
                            } else {
                                console.warn(`Invalid date format for property ${key}: ${value}`);
                            }
                        }

                        // Handle Multiple values and Images (Logic remains same as in your code)
                        if (isMultiple) {
                            let values = '';
                            if (isImage) {
                                // Logic for handling multiple images

                                values = await handleMultipleImages(value, key, propertyDefinition, checkImageExists, addFileToJcr, baseFilePath, pathSuffix.trim());
                            } else {
                                // Logic for handling multiple non-image values

                                values = handleMultipleValues(value, key);
                            }

                            return {
                                name: key,
                                values: values,
                                language: propertyDefinition?.internationalized ? language : undefined
                            };
                        }

                        if (isImage) {
                            // Logic for handling single images
                            const newValue = await handleSingleImage(value, key, checkImageExists, addFileToJcr, baseFilePath, pathSuffix.trim());
                            return {
                                name: key,
                                value: newValue,
                                language: propertyDefinition?.internationalized ? language : undefined
                            };
                        }

                        // Return structure for single values
                        return {
                            name: key,
                            value: value,
                            language: propertyDefinition?.internationalized ? language : undefined
                        };
                    })
                ).then(results => results.filter(Boolean)); // Filter out invalid properties

                const contentName = mappedEntry['jcr:title'] ?
                    mappedEntry['jcr:title'].replace(/\s+/g, '_').toLowerCase() :
                    mappedEntry.name ?
                        mappedEntry.name.replace(/\s+/g, '_').toLowerCase() :
                        `content_${new Date().getTime()}`;

                let contentUuid = null;
                console.log('Properties to send:', JSON.stringify(propertiesToSend, null, 2));
                try {
                    const {data: contentData} = await createContent({
                        variables: {
                            path: fullContentPath,
                            name: contentName,
                            primaryNodeType: selectedContentType, // Use your custom node type
                            properties: propertiesToSend
                        }
                    });
                    contentUuid = contentData?.jcr?.addNode?.uuid;

                    console.log(`Node created: ${fullContentPath}/${contentName}`);
                    successCount++; // Increment the success counter
                } catch (error) {
                    if (
                        error.message.includes('javax.jcr.ItemExistsException') ||
                        error.message.includes('This node already exists')
                    ) {
                        console.warn(`Node already exists: ${fullContentPath}/${contentName}`);
                        errorReport.push({
                            node: `${fullContentPath}/${contentName}`,
                            reason: 'Node already exists'
                        });
                    } else {
                        console.error(`Error creating node: ${fullContentPath}/${contentName}`, error);
                        errorReport.push({
                            node: `${fullContentPath}/${contentName}`,
                            reason: 'Other error',
                            details: error.message
                        });
                    }

                    continue;
                }

                // Add tags if available
                if (contentUuid && mappedEntry['j:tagList']) {
                    try {
                        await addTags({
                            variables: {
                                path: contentUuid,
                                tags: mappedEntry['j:tagList']
                            }
                        });
                        console.log(`Tags added to ${fullContentPath}/${contentName}`);
                    } catch (error) {
                        console.error(`Error adding tags to ${fullContentPath}/${contentName}:`, error);
                        errorReport.push({
                            node: `${fullContentPath}/${contentName}`,
                            reason: 'Error adding tags',
                            details: error.message
                        });
                    }
                }

                // Add Categories if avalaible
                if (contentUuid && mappedEntry['j:defaultCategory']) {
                    try {
                        await fetchCategoriesOnce(); // Ensure categories are loaded once

                        let defaultCategoryUuids = [];
                        if (Array.isArray(mappedEntry['j:defaultCategory'])) {
                            for (let categoryName of mappedEntry['j:defaultCategory']) {
                                // Normalize categoryName: lowercase + replace spaces with dashes
                                categoryName = categoryName.toLowerCase().replace(/\s+/g, '-');

                                const categoryUuid = categoryCache.current.get(categoryName);

                                if (categoryUuid) {
                                    defaultCategoryUuids.push(categoryUuid);
                                } else {
                                    console.warn(`Category ${categoryName} not found in cache.`);
                                }
                            }
                        }

                        // Add to properties if categories exist
                        if (defaultCategoryUuids.length > 0) {
                            await addCategories({
                                variables: {
                                    path: contentUuid,
                                    categories: defaultCategoryUuids
                                }
                            });
                        }
                    } catch (error) {
                        console.error(`Error adding categories to ${fullContentPath}/${contentName}:`, error);
                        errorReport.push({
                            node: `${fullContentPath}/${contentName}`,
                            reason: 'Error adding categories',
                            details: error.message
                        });
                    }
                }

                // Add Vanity URL if available
                if (contentUuid) {
                    try {
                        const cleanUrl = `/${pathSuffix.trim()}/${contentName.replace(/_/g, '-')}`;
                        await addVanityUrl({
                            variables: {
                                pathOrId: contentUuid,
                                language: language,
                                url: cleanUrl
                            }
                        });
                        console.log(`Vanity URL '${cleanUrl}' added to ${fullContentPath}/${contentName}`);
                    } catch (error) {
                        console.error(`Error adding vanity URL to ${fullContentPath}/${contentName}:`, error);
                        errorReport.push({
                            node: `${fullContentPath}/${contentName}`,
                            reason: 'Error adding vanity URL',
                            details: error.message
                        });
                    }
                }
            }

            // Step 4: Report success and errors
            if (errorReport.length > 0) {
                console.warn('Import completed with some issues:');
                console.table(errorReport);
                alert(
                    `Import completed with some issues. ${successCount} nodes were successfully created. Check the console for details.`
                );
            } else {
                console.log('Import completed successfully without errors!');
                alert(`${successCount} nodes were successfully created!`);
            }
        } catch (error) {
            console.error('Error during import:', error);
            alert('An error occurred during the import process.');
        } finally {
            setIsLoading(false); // Stop loading spinner
        }
    };

    return (
        <>

            {isLoading && (
                <div className={styles.loaderOverlay}>
                    <div className={styles.spinner}>
                        <LoaderOverlay status={isLoading}/>
                    </div>
                </div>
            )}

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
                        <Typography variant="body" className={styles.baseContentPath}>
                            {baseContentPath}/
                        </Typography>
                        <Input
                            value={pathSuffix}
                            placeholder={t('label.enterPathSuffix')}
                            className={styles.pathSuffixInput}
                            onChange={e => setPathSuffix(e.target.value)}
                        />
                    </div>
                    <Typography variant="body" className={`${styles.baseContentPath} ${styles.baseContentPathHelp}`}>                        {t('label.enterPathSuffixHelp')}
                    </Typography>
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
                            {properties.map(property => (
                                <div key={property.name} className={styles.propertyItem}>
                                    <Typography variant="body" className={styles.propertyText}>
                                        {property.displayName} - ({property.name} - {property.requiredType}{property.multiple ? '[]' : ''})
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
                            onChange={e => handleFileUpload(e.target.files[0])}
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
                    {properties.length > 0 && fileFields.length > 0 && (
                        <FieldMapping
                            properties={properties}
                            fileFields={fileFields}
                            fieldMappings={fieldMappings}
                            setFieldMappings={setFieldMappings}
                            t={t}
                        />
                    )}
                </div>
            </div>
        </>
    );
};
