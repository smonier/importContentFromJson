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
    UpdateContentMutation,
    AddVanityUrl,
    GET_SITE_LANGUAGES
} from '~/gql-queries/ImportContent.gql-queries';
import {handleMultipleImages, handleMultipleValues, handleSingleImage} from '~/Services/Services';

import {Button, Header, Dropdown, Typography, Input} from '@jahia/moonstone';
import Modal from '~/DesignSystem/Modal';
import {Tabs, Tab} from '~/DesignSystem/Tabs';
import {Checkbox} from '~/DesignSystem/Checkbox';
import {LoaderOverlay} from '~/DesignSystem/LoaderOverlay';
import styles from './ImportContent.component.scss';
import FieldMapping from './FieldMapping.jsx';
import LanguageSelector from './LanguageSelector.jsx';
import FileUploader from './FileUploader.jsx';
import PropertiesList from './PropertiesList.jsx';
import ImportPreviewDialog from './ImportPreviewDialog.jsx';
import ImportReportDialog from './ImportReportDialog.jsx';
import {useTranslation} from 'react-i18next';
import {extractAndFormatContentTypeData} from '~/ImportContentFromJson/ImportContent.utils.jsx';
import {
    ensurePathExists,
    flattenCategoryTree,
    generatePreviewData,
    nodeExists,
    extractFileFields
} from '~/ImportContentFromJson/ImportContent.utils.js';
import {
    validateFile,
    sanitizeNodeName,
    validatePath,
    sanitizePath,
    validateArraySize,
    validateImageUrl
} from '~/ImportContentFromJson/ImportContent.validation';
import logger from '~/ImportContentFromJson/ImportContent.logger';
import {processBatch, checkMemoryAvailability} from '~/ImportContentFromJson/ImportContent.performance';
import {MAX_FILE_SIZE, ERROR_MESSAGES} from '~/ImportContentFromJson/ImportContent.constants';

export default () => {
    const {t} = useTranslation('importContentFromJson');

    const TAG_LIST_FIELD = 'j:tagList';
    const DEFAULT_CATEGORY_FIELD = 'j:defaultCategory';

    const extraFields = [
        {name: TAG_LIST_FIELD, displayName: 'Tags'},
        {name: DEFAULT_CATEGORY_FIELD, displayName: 'Default category'}
    ];

    // --- UI state ------------------------------------------------------------
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isFilePreviewOpen, setIsFilePreviewOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [report, setReport] = useState(null);

    // --- Content type & properties -----------------------------------------
    const [selectedContentType, setSelectedContentType] = useState(null);
    const [contentTypes, setContentTypes] = useState([]);
    const [properties, setProperties] = useState([]);
    const [contentTypeError, setContentTypeError] = useState(null);
    const [propertiesError, setPropertiesError] = useState(null);

    // --- File handling ------------------------------------------------------
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [uploadedFileContent, setUploadedFileContent] = useState(null);
    const [fileFields, setFileFields] = useState([]);
    const [fieldMappings, setFieldMappings] = useState({});
    const [generatedFileName, setGeneratedFileName] = useState('');
    const [generatedFileContent, setGeneratedFileContent] = useState(null);
    const [generatedFileError, setGeneratedFileError] = useState('');
    const [jsonPreview, setJsonPreview] = useState(null);
    const [mappedPreview, setMappedPreview] = useState(null);
    // --- JSON validation flag -----------------------------------------------
    // Indicates that the currently selected import file (either a freshly
    // uploaded JSON/CSV or a previously generated JSON file) has passed
    // structure validation. Manual uploads reset the flag while generated file
    // uploads will set it to true once validated.
    const [isValidJson, setIsValidJson] = useState(false);

    // --- Path & categories --------------------------------------------------
    const siteKey = window.contextJsParameters.siteKey;
    const baseContentPath = `/sites/${siteKey}/contents`;
    const baseFilePath = `/sites/${siteKey}/files`;
    const [pathSuffix, setPathSuffix] = useState('');
    const [categoryTree, setCategoryTree] = useState(null);

    // Override existing content option
    const [overrideExisting, setOverrideExisting] = useState(false);
    const [createVanityUrl, setCreateVanityUrl] = useState(true);

    // --- Languages ----------------------------------------------------------
    const initialLanguage = window.contextJsParameters.uilang;
    const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);
    const [siteLanguages, setSiteLanguages] = useState([]);
    const [languageError, setLanguageError] = useState(null);

    // GraphQL Queries and Mutations
    const [fetchContentTypes, {data: contentTypeData}] = useLazyQuery(GetContentTypeQuery, {
        fetchPolicy: 'network-only',
        onError: error => {
            logger.error('GetContentType error', {error: error.message});
            setContentTypeError(error);
        }
    });

    const [fetchProperties, {data: propertiesData}] = useLazyQuery(GetContentPropertiesQuery, {
        fetchPolicy: 'network-only',
        onError: error => {
            logger.error('GetContentProperties error', {error: error.message});
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
            logger.error('Fetch categories error', {error: error.message});
        }
    });

    const [checkPath] = useLazyQuery(CheckPathQuery, {
        fetchPolicy: 'network-only',
        onError: error => logger.error('CheckPath error', {error: error.message})
    });
    const [createPath] = useMutation(CreatePathMutation, {
        onError: error => {
            logger.error('CreatePath error', {error: error.message});
            throw error;
        }
    });
    const [createContent] = useMutation(CreateContentMutation, {
        onError: error => {
            if (error.message.includes('javax.jcr.ItemExistsException') || error.message.includes('already exists')) {
                logger.info('CreateContent skipped - node already exists');
            } else {
                logger.error('CreateContent error', {error: error.message});
            }

            throw error;
        }
    });
    const [checkImageExists] = useLazyQuery(CheckImageExists, {
        onError: error => logger.error('CheckImageExists error', {error: error.message})
    });
    const [addFileToJcr] = useMutation(CreateFileMutation, {
        onError: error => {
            logger.error('CreateFile error', {error: error.message});
            throw error;
        }
    });
    const [addTags] = useMutation(AddTags, {
        onError: error => {
            logger.error('AddTags error', {error: error.message});
            throw error;
        }
    });
    const [checkIfCategoryExists] = useLazyQuery(CheckIfCategoryExists, {
        onError: error => logger.error('CheckIfCategoryExists error', {error: error.message})
    });
    const [addCategories] = useMutation(AddCategories, {
        onError: error => {
            logger.error('AddCategories error', {error: error.message});
            throw error;
        }
    });
    const [updateContent] = useMutation(UpdateContentMutation, {
        onError: error => {
            logger.error('UpdateContent error', {error: error.message});
            throw error;
        }
    });
    const [addVanityUrl] = useMutation(AddVanityUrl, {
        onError: error => {
            logger.error('AddVanityUrl error', {error: error.message});
            throw error;
        }
    });
    const [fetchSiteLanguages, {data: siteLanguagesData}] = useLazyQuery(GET_SITE_LANGUAGES, {
        variables: {workspace: 'EDIT', scope: `/sites/${siteKey}`},
        fetchPolicy: 'network-only',
        onError: error => {
            logger.error('GetSiteLanguages error', {error: error.message});
            setLanguageError(error);
        }
    });

    useEffect(() => {
        fetchSiteLanguages();
    }, [fetchSiteLanguages]);

    useEffect(() => {
        fetchContentTypes({variables: {siteKey, language: selectedLanguage}});
        if (selectedContentType) {
            fetchProperties({variables: {type: selectedContentType, language: selectedLanguage}});
        }
    }, [fetchContentTypes, fetchProperties, siteKey, selectedLanguage, selectedContentType]);

    useEffect(() => {
        if (contentTypeData?.jcr?.nodeTypes?.nodes) {
            const contentTypeDataFormated = extractAndFormatContentTypeData(contentTypeData);
            setContentTypes(contentTypeDataFormated);
            setContentTypeError(null);
        }
    }, [contentTypeData]);

    useEffect(() => {
        if (siteLanguagesData?.jcr?.nodeByPath?.languages?.values) {
            const langs = siteLanguagesData.jcr.nodeByPath.languages.values.map(l => ({label: l, value: l}));
            setSiteLanguages(langs);
            setLanguageError(null);
        }
    }, [siteLanguagesData]);

    useEffect(() => {
        if (propertiesData?.jcr?.nodeTypes?.nodes?.[0]) {
            const nodeType = propertiesData.jcr.nodeTypes.nodes[0];
            const mainProperties = nodeType.properties || [];
            
            // Collect properties from extendedBy mixins
            const extendedProperties = [];
            if (nodeType.extendedBy?.nodes) {
                nodeType.extendedBy.nodes.forEach(mixin => {
                    if (mixin.properties && mixin.properties.length > 0) {
                        // Add mixin info to each property for grouping
                        mixin.properties.forEach(prop => {
                            extendedProperties.push({
                                ...prop,
                                mixinName: mixin.name,
                                mixinDisplayName: mixin.displayName
                            });
                        });
                    }
                });
            }
            
            // Combine main properties and extended properties
            const allProperties = [...mainProperties, ...extendedProperties];
            setProperties(allProperties);
            setPropertiesError(null);
        }
    }, [propertiesData]);

    useEffect(() => {
        if ((properties.length > 0 || extraFields.length > 0) && fileFields.length > 0) {
            setFieldMappings(prev => {
                const mapping = {...prev};
                properties.forEach(prop => {
                    if (fileFields.includes(prop.name) && mapping[prop.name] === undefined) {
                        mapping[prop.name] = prop.name;
                    }
                });
                extraFields.forEach(field => {
                    if (fileFields.includes(field.name) && mapping[field.name] === undefined) {
                        mapping[field.name] = field.name;
                    }
                });

                [TAG_LIST_FIELD, DEFAULT_CATEGORY_FIELD].forEach(fieldName => {
                    if (fileFields.includes(fieldName) && mapping[fieldName] === undefined) {
                        mapping[fieldName] = fieldName;
                    }
                });

                return mapping;
            });
        }
    }, [properties, extraFields, fileFields, TAG_LIST_FIELD, DEFAULT_CATEGORY_FIELD]);

    const categoryCache = useRef(new Map()); // Store categories as { name: uuid }

    const fetchCategoriesOnce = async () => {
        if (categoryCache.current.size > 0) {
            return;
        }

        try {
            const {data} = await checkIfCategoryExists();
            if (data?.jcr?.nodeByPath?.children?.nodes) {
                logger.debug('Category Tree Loaded', {count: data.jcr.nodeByPath.children.nodes.length});
                flattenCategoryTree(data.jcr.nodeByPath.children.nodes, categoryCache.current);
            }
        } catch (error) {
            logger.error('GraphQL Category Fetch Error', {error: error.message});
        }
    };

    const handleContentTypeChange = selectedType => {
        setSelectedContentType(selectedType);
        fetchProperties({variables: {type: selectedType, language: selectedLanguage}});
    };

    const handleFileUpload = file => {
        // Clear previous file state
        setUploadedFileName('');
        setUploadedFileContent(null);
        setIsValidJson(false);

        if (!file) {
            logger.error('No file selected');
            return;
        }

        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
            logger.error('File validation failed', {error: validation.error});
            alert(validation.error);
            return;
        }

        logger.info('File uploaded', {name: file.name, size: file.size});

        const isJson = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
        const isCsv = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.name.toLowerCase().endsWith('.csv');

        setUploadedFileName(file.name);

        const reader = new FileReader();

        reader.onload = event => {
            try {
                if (isCsv) {
                    const result = Papa.parse(event.target.result, {header: true});
                    const rows = result.data.filter(row => Object.values(row).some(val => val));
                    
                    // Validate array size
                    const sizeValidation = validateArraySize(rows);
                    if (!sizeValidation.valid) {
                        logger.error('CSV size validation failed', {error: sizeValidation.error});
                        alert(sizeValidation.error);
                        return;
                    }
                    
                    setUploadedFileContent(rows);
                    setFileFields(result.meta?.fields || Object.keys(rows[0] || {}));
                    setIsValidJson(false);
                } else {
                    const jsonData = JSON.parse(event.target.result);
                    const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
                    
                    // Validate array size
                    const sizeValidation = validateArraySize(dataArray);
                    if (!sizeValidation.valid) {
                        logger.error('JSON size validation failed', {error: sizeValidation.error});
                        alert(sizeValidation.error);
                        return;
                    }
                    
                    setUploadedFileContent(jsonData);
                    const firstItem = dataArray[0];
                    setFileFields(extractFileFields(firstItem || {}));
                    setIsValidJson(false);
                }
            } catch (error) {
                logger.error('Error parsing file', {error: error.message});
                setIsValidJson(false);
                alert(ERROR_MESSAGES.INVALID_JSON);
            }
        };

        reader.onerror = () => {
            console.error('Error reading file');
            alert('Error reading file. Please try again.');
        };

        reader.readAsText(file); // Read the content of the new file
    };

    const handleGeneratedFileUpload = file => {
        setGeneratedFileName('');
        setGeneratedFileContent(null);
        setGeneratedFileError('');
        setIsValidJson(false);

        if (!file) {
            return;
        }

        console.log('Generated file uploaded', file.name);

        const isJson = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
        if (!isJson) {
            alert(t('label.invalidFile'));
            return;
        }

        const reader = new FileReader();
        reader.onload = event => {
            try {
                const jsonData = JSON.parse(event.target.result);
                const firstItem = Array.isArray(jsonData) ? jsonData[0] : jsonData;

                // === JSON Structure Validation ===
                console.group('=== JSON Structure Validation ===');
                console.info('Validating against selected content type properties');
                const jsonKeys = Object.keys(firstItem || {});
                const allowedKeys = properties.map(p => p.name);
                const invalidKeys = jsonKeys.filter(k => !allowedKeys.includes(k) && k !== TAG_LIST_FIELD && k !== DEFAULT_CATEGORY_FIELD);
                if (invalidKeys.length > 0) {
                    console.warn('❌ Invalid properties found in uploaded JSON:', invalidKeys);
                } else {
                    console.info('✅ All properties valid');
                }

                console.groupEnd();
                // === END JSON Structure Validation ===

                const fileProps = Object.keys(firstItem || {});
                const allowed = properties.map(p => p.name);
                const invalid = fileProps.filter(p => !allowed.includes(p) && p !== TAG_LIST_FIELD && p !== DEFAULT_CATEGORY_FIELD);

                if (invalid.length > 0) {
                    setGeneratedFileError(t('label.invalidGeneratedFile'));
                    console.log('Generated JSON validation failed', invalid);
                    setIsValidJson(false);
                } else {
                    setGeneratedFileName(file.name);
                    setGeneratedFileContent(jsonData);
                    setIsValidJson(true);
                    console.log('Generated JSON validation succeeded');
                }
            } catch (e) {
                alert('Invalid file.');
            }
        };

        reader.readAsText(file);
    };

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const handleGenerateJson = () => {
        logger.info('Generate JSON button clicked - manual mapping');

        if (!uploadedFileContent || !selectedContentType) {
            if (!uploadedFileContent) {
                alert(ERROR_MESSAGES.NO_FILE_UPLOADED);
            } else if (!selectedContentType) {
                alert(ERROR_MESSAGES.NO_CONTENT_TYPE);
            }

            return;
        }

        const preview = generatePreviewData(
            uploadedFileContent,
            fieldMappings,
            properties,
            extraFields.map(f => f.name)
        );
        setMappedPreview(preview);
        setIsValidJson(true); // Generated JSON is considered valid
        setIsPreviewOpen(true);
    };

    const startImport = async (previewData = jsonPreview) => {
        logger.info('Starting import');
        setIsLoading(true);
        
        // Validate and sanitize path
        const pathValidation = validatePath(pathSuffix);
        if (!pathValidation.valid) {
            logger.error('Path validation failed', {error: pathValidation.error});
            alert(pathValidation.error);
            setIsLoading(false);
            return;
        }
        
        const sanitizedPath = sanitizePath(pathSuffix);
        const fullContentPath = sanitizedPath ? `${baseContentPath}/${sanitizedPath}` : baseContentPath;
        const fullFilePath = sanitizedPath ? `${baseFilePath}/${sanitizedPath}` : baseFilePath;

        // === Pre-import Validation ===
        logger.group('=== Pre-import Validation ===');
        let contentPathExists = false;
        let filePathExists = false;

        try {
            const {exists} = await nodeExists(fullContentPath, checkPath);
            contentPathExists = exists;
        } catch (e) {
            if (e?.message?.includes('PathNotFoundException')) {
                logger.debug('Content path not found (expected)', {path: fullContentPath});
            } else {
                logger.error('Unexpected error checking content path', {path: fullContentPath, error: e.message});
            }
        }

        try {
            const {exists} = await nodeExists(fullFilePath, checkPath);
            filePathExists = exists;
        } catch (e) {
            if (e?.message?.includes('PathNotFoundException')) {
                logger.debug('File path not found (expected)', {path: fullFilePath});
            } else {
                logger.error('Unexpected error checking file path', {path: fullFilePath, error: e.message});
            }
        }

        // Now create if needed
        if (!contentPathExists) {
            logger.info('Creating content path', {path: fullContentPath});
            await ensurePathExists(fullContentPath, 'jnt:contentFolder', checkPath, createPath);
        } else {
            logger.debug('Content path exists', {path: fullContentPath});
        }

        if (!filePathExists) {
            logger.info('Creating file path', {path: fullFilePath});
            await ensurePathExists(fullFilePath, 'jnt:folder', checkPath, createPath);
        } else {
            logger.debug('File path exists', {path: fullFilePath});
        }

        logger.groupEnd();
        // === END Pre-import Validation ===

        const errorReport = [];
        let successCount = 0;
        let skippedCount = 0;
        let imageSuccessCount = 0;
        let imageFailCount = 0;
        let categorySuccessCount = 0;
        let categoryFailCount = 0;
        let vanitySuccessCount = 0;
        let vanityFailCount = 0;
        const selectedContentTypeOption = contentTypes.find(type => type.value === selectedContentType);
        const reportData = {
            nodes: [],
            images: [],
            categories: [],
            errors: [],
            path: fullContentPath,
            contentType: {
                value: selectedContentType || '',
                label: selectedContentTypeOption?.label || selectedContentType || ''
            }
        };
        let totalAttempts = 0;
        const computeSummary = () => {
            const validNodeEntries = reportData.nodes.filter(item => item?.name && item.name !== 'import');
            const nodeSummary = validNodeEntries.reduce((acc, item) => {
                switch (item.status) {
                    case 'created':
                        acc.created++;
                        break;
                    case 'updated':
                        acc.updated++;
                        break;
                    case 'already exists':
                        acc.skipped++;
                        break;
                    case 'failed':
                        acc.failed++;
                        break;
                    default:
                        break;
                }

                return acc;
            }, {created: 0, updated: 0, failed: 0, skipped: 0});

            const imageSummary = reportData.images.reduce((acc, item) => {
                if (!item) {
                    return acc;
                }

                switch (item.status) {
                    case 'created':
                        acc.created++;
                        break;
                    case 'updated':
                        acc.updated++;
                        break;
                    case 'already exists':
                        acc.skipped++;
                        break;
                    case 'failed':
                        acc.failed++;
                        break;
                    default:
                        break;
                }

                return acc;
            }, {created: 0, updated: 0, failed: 0, skipped: 0});

            const categorySummary = reportData.categories.reduce((acc, item) => {
                if (!item) {
                    return acc;
                }

                const categoryName = item.name || t('label.unknownCategory');

                switch (item.status) {
                    case 'created':
                        acc.created++;
                        acc.createdByName[categoryName] = (acc.createdByName[categoryName] || 0) + 1;
                        break;
                    case 'already exists':
                        acc.skipped++;
                        break;
                    case 'failed':
                        acc.failed++;
                        break;
                    default:
                        break;
                }

                return acc;
            }, {created: 0, failed: 0, skipped: 0, createdByName: {}});

            const vanitySkipped = createVanityUrl ?
                Math.max(totalAttempts - (vanitySuccessCount + vanityFailCount), 0) :
                totalAttempts;

            reportData.summary = {
                contentType: reportData.contentType,
                path: fullContentPath,
                nodes: {
                    processed: validNodeEntries.length,
                    total: totalAttempts,
                    ...nodeSummary
                },
                images: {
                    processed: reportData.images.length,
                    total: reportData.images.length,
                    ...imageSummary
                },
                categories: {
                    processed: reportData.categories.length,
                    ...categorySummary
                },
                vanityUrls: {
                    enabled: createVanityUrl,
                    created: vanitySuccessCount,
                    failed: vanityFailCount,
                    skipped: vanitySkipped
                }
            };
        };

        try {
            if (!previewData) {
                alert(ERROR_MESSAGES.NO_FILE_UPLOADED);
                return;
            }

            if (!isValidJson) {
                alert(ERROR_MESSAGES.INVALID_JSON);
                return;
            }

            if (!selectedContentType) {
                alert(ERROR_MESSAGES.NO_CONTENT_TYPE);
                return;
            }

            const propertyDefinitions = properties;

            if (!Array.isArray(previewData)) {
                logger.error('Invalid preview data format', {isArray: Array.isArray(previewData)});
                alert(ERROR_MESSAGES.INVALID_JSON);
                return;
            }

            for (const mappedEntry of previewData) {
                const contentName = sanitizeNodeName(
                    mappedEntry['jcr:title'] || mappedEntry.name || `content_${Date.now()}`
                );
                const fullNodePath = `${fullContentPath}/${contentName}`;
                const nodeReport = {name: fullNodePath, status: 'created'};

                const {exists, uuid: existingUuid} = await nodeExists(fullNodePath, checkPath);
                if (exists && !overrideExisting) {
                    reportData.nodes.push({name: fullNodePath, status: 'already exists'});
                    skippedCount++;
                    errorReport.push({node: fullNodePath, reason: 'Node already exists', details: ''});
                    continue;
                }

                const imageResultsBuffer = [];
                const categoryResultsBuffer = [];

                const propertiesToSend = await Promise.all(
                    Object.keys(mappedEntry).map(async key => {
                        if (key === TAG_LIST_FIELD || key === DEFAULT_CATEGORY_FIELD) {
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
                                const imgRes = await handleMultipleImages(value, key, propertyDefinition, checkImageExists, addFileToJcr, baseFilePath, pathSuffix.trim());
                                imgRes.forEach(r => {
                                    imageResultsBuffer.push({name: r.name, status: r.status, node: nodeReport.name});
                                });
                                imageSuccessCount += imgRes.filter(r => r.status !== 'failed').length;
                                imageFailCount += imgRes.filter(r => r.status === 'failed').length;
                                values = imgRes.map(r => r.uuid).filter(Boolean);
                            } else {
                                values = handleMultipleValues(value, key);
                            }

                            return {
                                name: key,
                                values: values,
                                language: propertyDefinition?.internationalized ? selectedLanguage : undefined
                            };
                        }

                        if (isImage) {
                            try {
                                const imgRes = await handleSingleImage(value, key, checkImageExists, addFileToJcr, baseFilePath, pathSuffix.trim());
                                imageResultsBuffer.push({name: imgRes.name, status: imgRes.status, node: nodeReport.name});
                                if (imgRes.status !== 'failed') {
                                    imageSuccessCount++;
                                } else {
                                    imageFailCount++;
                                }

                                return {
                                    name: key,
                                    value: imgRes.uuid,
                                    language: propertyDefinition?.internationalized ? selectedLanguage : undefined
                                };
                            } catch (err) {
                                imageFailCount++;
                                errorReport.push({node: contentName, reason: 'Image import failed', details: err.message});
                                return null;
                            }
                        }

                        return {
                            name: key,
                            value: value,
                            language: propertyDefinition?.internationalized ? selectedLanguage : undefined
                        };
                    })
                ).then(results => results.filter(Boolean));
                reportData.images.push(...imageResultsBuffer);

                // Determine required mixins based on properties being set
                const requiredMixins = new Set(['jmix:editorialContent']);
                propertiesToSend.forEach(prop => {
                    const propertyDef = propertyDefinitions.find(p => p.name === prop.name);
                    if (propertyDef && propertyDef.mixinName) {
                        requiredMixins.add(propertyDef.mixinName);
                    }
                });
                const mixinsArray = Array.from(requiredMixins);

                let contentUuid = null;
                try {
                    if (exists && overrideExisting) {
                        const {data: updateData} = await updateContent({
                            variables: {
                                pathOrId: existingUuid,
                                mixins: mixinsArray,
                                properties: propertiesToSend
                            }
                        });
                        contentUuid = updateData?.jcr?.mutateNode?.uuid || existingUuid;
                        if (!contentUuid) {
                            throw new Error('Update mutation did not return a node UUID.');
                        }

                        nodeReport.status = 'updated';
                        console.info(`Content updated: ${fullNodePath}`);
                    } else {
                        const {data: contentData} = await createContent({
                            variables: {
                                path: fullContentPath,
                                name: contentName,
                                primaryNodeType: selectedContentType,
                                mixins: mixinsArray,
                                properties: propertiesToSend
                            }
                        });
                        contentUuid = contentData?.jcr?.addNode?.uuid;
                        if (!contentUuid) {
                            throw new Error('Create mutation did not return a node UUID.');
                        }

                        nodeReport.status = 'created';
                        console.info(`Content created: ${fullNodePath}`);
                    }

                    successCount++;
                } catch (error) {
                    const action = exists && overrideExisting ? 'update' : 'creation';
                    nodeReport.status = 'failed';
                    errorReport.push({
                        node: `${fullContentPath}/${contentName}`,
                        reason: `Content ${action} failed`,
                        details: error.message
                    });
                    reportData.nodes.push(nodeReport);
                    continue;
                }

                reportData.nodes.push(nodeReport);

                if (contentUuid && Array.isArray(mappedEntry[TAG_LIST_FIELD]) && mappedEntry[TAG_LIST_FIELD].length > 0) {
                    try {
                        await addTags({variables: {path: contentUuid, tags: mappedEntry[TAG_LIST_FIELD]}});
                    } catch (error) {
                        errorReport.push({
                            node: `${fullContentPath}/${contentName}`,
                            reason: 'Error adding tags',
                            details: error.message
                        });
                    }
                }

                if (contentUuid && Array.isArray(mappedEntry[DEFAULT_CATEGORY_FIELD]) && mappedEntry[DEFAULT_CATEGORY_FIELD].length > 0) {
                    try {
                        await fetchCategoriesOnce();

                        let defaultCategoryUuids = [];
                        if (Array.isArray(mappedEntry[DEFAULT_CATEGORY_FIELD])) {
                            for (let categoryName of mappedEntry[DEFAULT_CATEGORY_FIELD]) {
                                categoryName = categoryName.toLowerCase().replace(/\s+/g, '-');
                                const categoryUuid = categoryCache.current.get(categoryName);
                                if (categoryUuid) {
                                    defaultCategoryUuids.push(categoryUuid);
                                }
                            }
                        }

                        if (defaultCategoryUuids.length > 0) {
                            try {
                                await addCategories({variables: {path: contentUuid, categories: defaultCategoryUuids}});
                                categorySuccessCount += defaultCategoryUuids.length;
                                mappedEntry[DEFAULT_CATEGORY_FIELD].forEach(cat => {
                                    categoryResultsBuffer.push({name: cat, status: 'created', node: nodeReport.name});
                                });
                            } catch (err) {
                                categoryFailCount += defaultCategoryUuids.length;
                                mappedEntry[DEFAULT_CATEGORY_FIELD].forEach(cat => {
                                    categoryResultsBuffer.push({name: cat, status: 'failed', node: nodeReport.name});
                                });
                                errorReport.push({node: contentName, reason: 'Error adding categories', details: err.message});
                            }
                        } else {
                            categoryFailCount += (mappedEntry[DEFAULT_CATEGORY_FIELD] || []).length;
                            (mappedEntry[DEFAULT_CATEGORY_FIELD] || []).forEach(cat => {
                                categoryResultsBuffer.push({name: cat, status: 'failed', node: nodeReport.name});
                            });
                            errorReport.push({node: contentName, reason: 'No matching category UUID found', details: ''});
                        }
                    } catch (error) {
                        errorReport.push({
                            node: `${fullContentPath}/${contentName}`,
                            reason: 'Error adding categories',
                            details: error.message
                        });
                    }
                }

                reportData.categories.push(...categoryResultsBuffer);

                if (contentUuid && createVanityUrl) {
                    try {
                        const cleanUrl = `/${pathSuffix.trim()}/${contentName.replace(/_/g, '-')}`;
                        await addVanityUrl({variables: {pathOrId: contentUuid, language: selectedLanguage, url: cleanUrl}});
                        vanitySuccessCount++;
                    } catch (error) {
                        vanityFailCount++;
                        errorReport.push({
                            node: `${fullContentPath}/${contentName}`,
                            reason: 'Error adding vanity URL',
                            details: error.message
                        });
                    }
                }
            }

            // Final import summary report
            totalAttempts = previewData.length;
            const failedCount = errorReport.filter(e => e.reason !== 'Node already exists').length;
            const skippedNodes = errorReport.filter(e => e.reason === 'Node already exists').length;

            console.group('=== Import Summary ===');
            console.info(`✅ Success: ${successCount}`);
            if (skippedNodes > 0) {
                console.info(`⏭️ Skipped: ${skippedNodes}`);
            }

            console.warn(`❌ Failed: ${failedCount}`);

            // Detailed summary
            if (errorReport.length > 0) {
                console.warn(`❌ ${failedCount} failed nodes${skippedNodes ? `, ${skippedNodes} skipped` : ''}:`);
                errorReport.forEach(e => console.warn(`• ${e.node} → ${e.reason}`));

                console.table(errorReport.map(entry => ({
                    Node: entry.node,
                    Reason: entry.reason,
                    Details: entry.details || ''
                })));
            }

            console.info(`🖼️ Images: ${imageSuccessCount} success, ${imageFailCount} failed`);
            console.info(`🏷️ Categories: ${categorySuccessCount} success, ${categoryFailCount} failed`);
            console.groupEnd();

            computeSummary();
            reportData.errors = errorReport;
            setReport(reportData);
            setIsReportOpen(true);
        } catch (error) {
            console.error('Error during import:', error.message);
            reportData.errors.push({node: 'import', reason: 'Unexpected error', details: error.message});
            reportData.nodes.push({name: 'import', status: 'failed'});
            computeSummary();
            setReport(reportData);
            setIsReportOpen(true);
        } finally {
            setIsLoading(false);
            setIsPreviewOpen(false);
        }
    };

    const handleDownloadJson = (preview = jsonPreview) => {
        console.log('Download button clicked');
        if (!preview) {
            return;
        }

        const blob = new Blob([JSON.stringify(preview, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mappedContent.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const importGeneratedFile = () => {
        console.log('Import button clicked - re-import');
        if (!generatedFileContent) {
            return;
        }

        setJsonPreview(generatedFileContent);
        // Use local variable to avoid stale state issues
        startImport(generatedFileContent);
    };

    // --- Folder Picker Handler ---
    const handleOpenPathPicker = () => {
        const initialPath = pathSuffix ? `${baseContentPath}/${pathSuffix}` : baseContentPath;

        window.CE_API.openPicker({
            type: 'editorial',
            initialSelectedItem: [initialPath],
            site: window.jahiaGWTParameters.siteKey,
            lang: window.jahiaGWTParameters.uilang,
            isMultiple: false,
            setValue: ([selected]) => {
                if (selected?.path) {
                    const selectedPath = selected.path.replace(`${baseContentPath}/`, '');
                    setPathSuffix(selectedPath);
                }
            }
        });
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
                        isDisabled={
                            activeTab === 0 ?
                                (!selectedContentType || !uploadedFileContent) :
                                (!selectedContentType || !generatedFileContent || generatedFileError)
                        }
                        label={activeTab === 0 ? t('label.generateJsonFile') : t('label.importFromJson')}
                        onClick={activeTab === 0 ? handleGenerateJson : importGeneratedFile}
                    />
                ]}
            />
                <div className={styles.container}>
                    <div className={styles.leftPanel}>
                        <Typography variant="subheading" className={styles.heading}>
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
                            <Button
                                label={t('label.selectFolder')}
                                onClick={handleOpenPathPicker}
                            />
                        </div>
                        <Typography variant="body" className={`${styles.baseContentPath} ${styles.baseContentPathHelp}`}>
                            {t('label.enterPathSuffixHelp')}
                        </Typography>
                        <div className={styles.optionsSection}>
                            <Typography variant="caption" className={styles.optionsTitle}>
                                {t('label.options')}
                            </Typography>
                            <Checkbox
                                checked={overrideExisting}
                                onChange={e => setOverrideExisting(e.target.checked)}
                                label={t('label.overrideExisting')}
                            />
                            <Checkbox
                                checked={createVanityUrl}
                                onChange={e => setCreateVanityUrl(e.target.checked)}
                                label={t('label.createVanityUrl')}
                            />
                        </div>
                        <LanguageSelector
                            languages={siteLanguages}
                            selectedLanguage={selectedLanguage}
                            error={languageError}
                            t={t}
                            onChange={setSelectedLanguage}
                        />
                        <Typography variant="subheading" className={styles.heading}>
                            {t('label.selectContentType')}
                        </Typography>
                        <Dropdown
                            data={contentTypes}
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
                        {selectedContentType && (
                            <PropertiesList properties={properties} error={propertiesError} t={t}/>
                        )}
                    </div>

                    <div className={styles.rightPanel}>
                        <Tabs value={activeTab} onChange={handleTabChange}>
                            <Tab label={t('label.manualMapping')} />
                            <Tab label={t('label.reImportGeneratedFile')} />
                        </Tabs>
                        {activeTab === 0 && (
                        <div className={styles.tabContent}>
                            <Typography variant="subheading" className={styles.heading}>
                                {t('label.uploadFile')}
                            </Typography>
                            <FileUploader
                                id="fileUpload"
                                fileName={uploadedFileName}
                                showPreview={Boolean(uploadedFileContent)}
                                t={t}
                                onChange={handleFileUpload}
                                onPreview={() => setIsFilePreviewOpen(true)}
                            />
                            {properties.length > 0 && fileFields.length > 0 && (
                                <FieldMapping
                                    properties={properties}
                                    extraFields={extraFields}
                                    fileFields={fileFields}
                                    fieldMappings={fieldMappings}
                                    setFieldMappings={setFieldMappings}
                                    t={t}
                                />
                            )}
                        </div>
                    )}
                        {activeTab === 1 && (
                        <div className={styles.tabContent}>
                            <Typography variant="subheading" className={styles.heading}>
                                {t('label.uploadGeneratedFile')}
                            </Typography>
                            <FileUploader
                                id="generatedUpload"
                                fileName={generatedFileName}
                                t={t}
                                onChange={handleGeneratedFileUpload}
                            />
                            {generatedFileError && (
                                <Typography variant="body" className={styles.errorMessage}>
                                    {generatedFileError}
                                </Typography>
                            )}
                            {generatedFileContent && (
                                <pre className={styles.previewContent}>{JSON.stringify(generatedFileContent, null, 2)}</pre>
                            )}
                        </div>
                    )}
                    </div>
                </div>
            </div>
            <Modal
                open={isFilePreviewOpen}
                onClose={() => setIsFilePreviewOpen(false)}
                title={t('label.filePreviewTitle')}
                maxWidth="md"
                fullWidth
                actions={[
                    <Button key="close" label={t('label.close')} onClick={() => setIsFilePreviewOpen(false)}/>
                ]}
            >
                <pre className={styles.previewContent}>{JSON.stringify(uploadedFileContent, null, 2)}</pre>
            </Modal>
            <ImportPreviewDialog
                open={isPreviewOpen}
                previewData={mappedPreview}
                t={t}
                onClose={() => setIsPreviewOpen(false)}
                onDownload={() => handleDownloadJson(mappedPreview)}
                onStart={() => startImport(mappedPreview)}
            />
            <ImportReportDialog
                open={isReportOpen}
                report={report}
                t={t}
                onClose={() => setIsReportOpen(false)}
            />
        </>
    );
};
