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
import {Dialog, DialogTitle, DialogContent, DialogActions} from '@mui/material';

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
    const [uploadedFileContent, setUploadedFileContent] = useState(null); // Full JSON content
    const [fileFields, setFileFields] = useState([]);
    const [fieldMappings, setFieldMappings] = useState({});
    const [jsonPreview, setJsonPreview] = useState(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [contentTypeError, setContentTypeError] = useState(null);
    const [propertiesError, setPropertiesError] = useState(null);
    const siteKey = window.contextJsParameters.siteKey;
    const [pathSuffix, setPathSuffix] = useState(''); // Editable suffix for the base path
    const [categoryTree, setCategoryTree] = useState(null);

    const language = window.contextJsParameters.uilang;
    const baseContentPath = `/sites/${siteKey}/contents`; // Fixed base path
    const baseFilePath = `/sites/${siteKey}/files`;

    // GraphQL Queries and Mutations
    const [fetchContentTypes, {data: contentTypeData}] = useLazyQuery(GetContentTypeQuery, {
        variables: {siteKey, language},
        fetchPolicy: 'network-only',
        onError: error => {
            console.error('GetContentType error', error);
            setContentTypeError(error);
        }
    });

    const [fetchProperties, {data: propertiesData}] = useLazyQuery(GetContentPropertiesQuery, {
        fetchPolicy: 'network-only',
        onError: error => {
            console.error('GetContentProperties error', error);
            setPropertiesError(error);
        }
    });

    const [fetchCategories, {data: categoryData}] = useLazyQuery(CheckIfCategoryExists, {
        fetchPolicy: 'network-only', // Ensures we get fresh data once
        onCompleted: data => {
            if (data?.jcr?.nodeByPath?.children?.nodes) {
                setCategoryTree(data.jcr.nodeByPath.children.nodes);
            }
        },
        onError: error => {
            console.error('Fetch categories error', error);
        }
    });

    const [checkPath] = useLazyQuery(CheckPathQuery, {
        fetchPolicy: 'network-only',
        onError: error => console.error('CheckPath error', error)
    });
    const [createPath] = useMutation(CreatePathMutation, {
        onError: error => console.error('CreatePath error', error)
    });
    const [createContent] = useMutation(CreateContentMutation, {
        onError: error => console.error('CreateContent error', error)
    });
    const [checkImageExists] = useLazyQuery(CheckImageExists, {
        onError: error => console.error('CheckImageExists error', error)
    });
    const [addFileToJcr] = useMutation(CreateFileMutation, {
        onError: error => console.error('CreateFile error', error)
    });
    const [addTags] = useMutation(AddTags, {
        onError: error => console.error('AddTags error', error)
    });
    const [checkIfCategoryExists] = useLazyQuery(CheckIfCategoryExists, {
        onError: error => console.error('CheckIfCategoryExists error', error)
    });
    const [addCategories] = useMutation(AddCategories, {
        onError: error => console.error('AddCategories error', error)
    });
    const [addVanityUrl] = useMutation(AddVanityUrl, {
        onError: error => console.error('AddVanityUrl error', error)
    });

    useEffect(() => {
        fetchContentTypes();
    }, [fetchContentTypes]);

    useEffect(() => {
        if (contentTypeData?.jcr?.nodeTypes?.nodes) {
            const contentTypeDataFormated = extractAndFormatContentTypeData(contentTypeData);
            setContentTypes(contentTypeDataFormated);
            setContentTypeError(null);
        }
    }, [contentTypeData]);

    useEffect(() => {
        if (propertiesData?.jcr?.nodeTypes?.nodes?.[0]?.properties) {
            setProperties(propertiesData.jcr.nodeTypes.nodes[0].properties);
            setPropertiesError(null);
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
        try {
            const {data} = await checkIfCategoryExists();
            if (data?.jcr?.nodeByPath?.children?.nodes) {
                console.log('Category Tree Loaded:', data.jcr.nodeByPath.children.nodes);
                flattenCategoryTree(data.jcr.nodeByPath.children.nodes, categoryCache.current);
            }
        } catch (error) {
            console.error('GraphQL Category Fetch Error:', error);
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
                    setFileFields(result.meta?.fields || Object.keys(rows[0] || {}));
                } else {
                    const jsonData = JSON.parse(event.target.result);
                    setUploadedFileContent(jsonData); // Store full JSON content
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

    const generatePreviewData = () => {
        if (!uploadedFileContent) {
            return [];
        }

        return uploadedFileContent.map(rawEntry => {
            const mappedEntry = {};
            Object.entries(fieldMappings).forEach(([propName, fileField]) => {
                if (rawEntry[fileField] === undefined) {
                    return;
                }

                let value = rawEntry[fileField];
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
                    } else {
                        if (typeof value === 'string') {
                            value = {url: value};
                        }
                    }
                }

                mappedEntry[propName] = value;
            });

            if (rawEntry['j:tagList']) {
                mappedEntry['j:tagList'] = rawEntry['j:tagList'];
            }

            if (rawEntry['j:defaultCategory']) {
                mappedEntry['j:defaultCategory'] = rawEntry['j:defaultCategory'];
            }

            return mappedEntry;
        });
    };

    const handleImport = () => {
        if (!uploadedFileContent || !selectedContentType) {
            // eslint-disable-next-line no-alert
            alert('Please upload a valid JSON file and select a content type.');
            return;
        }

        const preview = generatePreviewData();
        setJsonPreview(preview);
        setIsPreviewOpen(true);
    };

    const startImport = async () => {
        setIsLoading(true);
        const fullContentPath = pathSuffix ? `${baseContentPath}/${pathSuffix.trim()}` : baseContentPath;
        const fullFilePath = pathSuffix ? `${baseFilePath}/${pathSuffix.trim()}` : baseFilePath;

        const errorReport = [];
        let successCount = 0;

        try {
            const ensurePathExists = async (fullPath, nodeType) => {
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

            await ensurePathExists(fullContentPath, 'jnt:contentFolder');
            await ensurePathExists(fullFilePath, 'jnt:folder');

            if (!jsonPreview || !selectedContentType) {
                // eslint-disable-next-line no-alert
                alert('Please upload a valid JSON file and select a content type.');
                return;
            }

            const propertyDefinitions = properties;

            for (const mappedEntry of jsonPreview) {
                const propertiesToSend = await Promise.all(
                    Object.keys(mappedEntry).map(async key => {
                        if (key === 'j:tagList' || key === 'j:defaultCategory') {
                            return null;
                        }

                        const propertyDefinition = propertyDefinitions.find(prop => prop.name === key);
                        if (!propertyDefinition) {
                            return null;
                        }

                        let value = mappedEntry[key];
                        const isImage = propertyDefinition.constraints?.includes('{http://www.jahia.org/jahia/mix/1.0}image');
                        const isDate = propertyDefinition.requiredType === 'DATE';
                        const isMultiple = propertyDefinition.multiple;

                        if (isDate && value) {
                            const date = new Date(value);
                            if (!isNaN(date.getTime())) {
                                value = date.toISOString();
                            }
                        }

                        if (isMultiple) {
                            let values = '';
                            if (isImage) {
                                values = await handleMultipleImages(value, key, propertyDefinition, checkImageExists, addFileToJcr, baseFilePath, pathSuffix.trim());
                            } else {
                                values = handleMultipleValues(value, key);
                            }

                            return {
                                name: key,
                                values: values,
                                language: propertyDefinition?.internationalized ? language : undefined
                            };
                        }

                        if (isImage) {
                            const newValue = await handleSingleImage(value, key, checkImageExists, addFileToJcr, baseFilePath, pathSuffix.trim());
                            return {
                                name: key,
                                value: newValue,
                                language: propertyDefinition?.internationalized ? language : undefined
                            };
                        }

                        return {
                            name: key,
                            value: value,
                            language: propertyDefinition?.internationalized ? language : undefined
                        };
                    })
                ).then(results => results.filter(Boolean));

                const contentName = mappedEntry['jcr:title'] ?
                    mappedEntry['jcr:title'].replace(/\s+/g, '_').toLowerCase() :
                    mappedEntry.name ?
                        mappedEntry.name.replace(/\s+/g, '_').toLowerCase() :
                        `content_${new Date().getTime()}`;

                let contentUuid = null;
                try {
                    const {data: contentData} = await createContent({
                        variables: {
                            path: fullContentPath,
                            name: contentName,
                            primaryNodeType: selectedContentType,
                            properties: propertiesToSend
                        }
                    });
                    contentUuid = contentData?.jcr?.addNode?.uuid;
                    successCount++;
                } catch (error) {
                    if (
                        error.message.includes('javax.jcr.ItemExistsException') ||
                        error.message.includes('This node already exists')
                    ) {
                        errorReport.push({
                            node: `${fullContentPath}/${contentName}`,
                            reason: 'Node already exists'
                        });
                    } else {
                        errorReport.push({
                            node: `${fullContentPath}/${contentName}`,
                            reason: 'Other error',
                            details: error.message
                        });
                    }

                    continue;
                }

                if (contentUuid && mappedEntry['j:tagList']) {
                    try {
                        await addTags({variables: {path: contentUuid, tags: mappedEntry['j:tagList']}});
                    } catch (error) {
                        errorReport.push({
                            node: `${fullContentPath}/${contentName}`,
                            reason: 'Error adding tags',
                            details: error.message
                        });
                    }
                }

                if (contentUuid && mappedEntry['j:defaultCategory']) {
                    try {
                        await fetchCategoriesOnce();

                        let defaultCategoryUuids = [];
                        if (Array.isArray(mappedEntry['j:defaultCategory'])) {
                            for (let categoryName of mappedEntry['j:defaultCategory']) {
                                categoryName = categoryName.toLowerCase().replace(/\s+/g, '-');
                                const categoryUuid = categoryCache.current.get(categoryName);
                                if (categoryUuid) {
                                    defaultCategoryUuids.push(categoryUuid);
                                }
                            }
                        }

                        if (defaultCategoryUuids.length > 0) {
                            await addCategories({variables: {path: contentUuid, categories: defaultCategoryUuids}});
                        }
                    } catch (error) {
                        errorReport.push({
                            node: `${fullContentPath}/${contentName}`,
                            reason: 'Error adding categories',
                            details: error.message
                        });
                    }
                }

                if (contentUuid) {
                    try {
                        const cleanUrl = `/${pathSuffix.trim()}/${contentName.replace(/_/g, '-')}`;
                        await addVanityUrl({variables: {pathOrId: contentUuid, language: language, url: cleanUrl}});
                    } catch (error) {
                        errorReport.push({
                            node: `${fullContentPath}/${contentName}`,
                            reason: 'Error adding vanity URL',
                            details: error.message
                        });
                    }
                }
            }

            if (errorReport.length > 0) {
                console.warn('Import completed with some issues:');
                console.table(errorReport);
                alert(`Import completed with some issues. ${successCount} nodes were successfully created. Check the console for details.`);
            } else {
                console.log('Import completed successfully without errors!');
                alert(`${successCount} nodes were successfully created!`);
            }
        } catch (error) {
            console.error('Error during import:', error);
            alert('An error occurred during the import process.');
        } finally {
            setIsLoading(false);
            setIsPreviewOpen(false);
        }
    };

    const handleDownloadJson = () => {
        if (!jsonPreview) {
            return;
        }

        const blob = new Blob([JSON.stringify(jsonPreview, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mappedContent.json';
        a.click();
        URL.revokeObjectURL(url);
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

        <div className={styles.layout}>
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
                    {contentTypeError && (
                        <Typography variant="body" className={styles.errorMessage}>
                            {t('label.loadContentTypesError')}
                        </Typography>
                    )}
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
                        {propertiesError && (
                            <Typography variant="body" className={styles.errorMessage}>
                                {t('label.loadPropertiesError')}
                            </Typography>
                        )}
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
        </div>
        <Dialog fullWidth open={isPreviewOpen} maxWidth="md" onClose={() => setIsPreviewOpen(false)}>
            <DialogTitle>{t('label.previewTitle')}</DialogTitle>
                <DialogContent dividers>
                    <pre className={styles.previewContent}>{JSON.stringify(jsonPreview, null, 2)}</pre>
                </DialogContent>
                <DialogActions>
                    <Button label={t('label.downloadJson')} onClick={handleDownloadJson}/>
                    <Button color="accent" label={t('label.startImport')} onClick={startImport}/>
                </DialogActions>
            </Dialog>
        </>
    );
};
