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
import {Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, Checkbox, FormControlLabel} from '@mui/material';

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

    // --- Languages ----------------------------------------------------------
    const initialLanguage = window.contextJsParameters.uilang;
    const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);
    const [siteLanguages, setSiteLanguages] = useState([]);
    const [languageError, setLanguageError] = useState(null);

    // GraphQL Queries and Mutations
    const [fetchContentTypes, {data: contentTypeData}] = useLazyQuery(GetContentTypeQuery, {
        fetchPolicy: 'network-only',
        onError: error => {
            console.error('GetContentType error:', error.message);
            setContentTypeError(error);
        }
    });

    const [fetchProperties, {data: propertiesData}] = useLazyQuery(GetContentPropertiesQuery, {
        fetchPolicy: 'network-only',
        onError: error => {
            console.error('GetContentProperties error:', error.message);
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
            console.error('Fetch categories error:', error.message);
        }
    });

    const [checkPath] = useLazyQuery(CheckPathQuery, {
        fetchPolicy: 'network-only',
        onError: error => console.error('CheckPath error:', error.message)
    });
    const [createPath] = useMutation(CreatePathMutation, {
        onError: error => console.error('CreatePath error:', error.message)
    });
    const [createContent] = useMutation(CreateContentMutation, {
        onError: error => {
            if (error.message.includes('javax.jcr.ItemExistsException') || error.message.includes('already exists')) {
                console.info('CreateContent skipped - node already exists');
            } else {
                console.error('CreateContent error:', error.message);
            }
        }
    });
    const [checkImageExists] = useLazyQuery(CheckImageExists, {
        onError: error => console.error('CheckImageExists error:', error.message)
    });
    const [addFileToJcr] = useMutation(CreateFileMutation, {
        onError: error => console.error('CreateFile error:', error.message)
    });
    const [addTags] = useMutation(AddTags, {
        onError: error => console.error('AddTags error:', error.message)
    });
    const [checkIfCategoryExists] = useLazyQuery(CheckIfCategoryExists, {
        onError: error => console.error('CheckIfCategoryExists error:', error.message)
    });
    const [addCategories] = useMutation(AddCategories, {
        onError: error => console.error('AddCategories error:', error.message)
    });
    const [updateContent] = useMutation(UpdateContentMutation, {
        onError: error => console.error('UpdateContent error:', error.message)
    });
    const [addVanityUrl] = useMutation(AddVanityUrl, {
        onError: error => console.error('AddVanityUrl error:', error.message)
    });
    const [fetchSiteLanguages, {data: siteLanguagesData}] = useLazyQuery(GET_SITE_LANGUAGES, {
        variables: {workspace: 'EDIT', scope: `/sites/${siteKey}`},
        fetchPolicy: 'network-only',
        onError: error => {
            console.error('GetSiteLanguages error:', error.message);
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
        if (propertiesData?.jcr?.nodeTypes?.nodes?.[0]?.properties) {
            setProperties(propertiesData.jcr.nodeTypes.nodes[0].properties);
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
                console.log('Category Tree Loaded:', data.jcr.nodeByPath.children.nodes);
                flattenCategoryTree(data.jcr.nodeByPath.children.nodes, categoryCache.current);
            }
        } catch (error) {
            console.error('GraphQL Category Fetch Error:', error.message);
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
            console.error('No file selected');
            return;
        }

        console.log('File uploaded', file.name);

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
                    setIsValidJson(false); // Not JSON, so not valid for JSON import
                } else {
                    const jsonData = JSON.parse(event.target.result);
                    setUploadedFileContent(jsonData); // Store full JSON content
                    const firstItem = Array.isArray(jsonData) ? jsonData[0] : jsonData;
                    setFileFields(extractFileFields(firstItem || {}));
                    setIsValidJson(false); // Structure validation will set to true
                }
            } catch (error) {
                console.error('Error parsing file:', error.message);
                setIsValidJson(false);
                alert('Invalid file. Please check the file contents.');
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
        console.log('Generate JSON button clicked - manual mapping');

        if (!uploadedFileContent || !selectedContentType) {
            if (!uploadedFileContent) {
                alert('Please upload a valid JSON file.');
            } else if (!selectedContentType) {
                alert('Please select a content type.');
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
        console.log('Starting import');
        setIsLoading(true);
        const fullContentPath = pathSuffix ? `${baseContentPath}/${pathSuffix.trim()}` : baseContentPath;
        const fullFilePath = pathSuffix ? `${baseFilePath}/${pathSuffix.trim()}` : baseFilePath;

        // === Pre-import Validation ===
        console.group('=== Pre-import Validation ===');
        let contentPathExists = false;
        let filePathExists = false;

        try {
            const {exists} = await nodeExists(fullContentPath, checkPath);
            contentPathExists = exists;
        } catch (e) {
            if (e?.message?.includes('PathNotFoundException')) {
                console.debug(`🔍 Content path not found (expected): ${fullContentPath}`);
            } else {
                console.error(`❌ Unexpected error checking content path: ${fullContentPath}`, e);
            }
        }

        try {
            const {exists} = await nodeExists(fullFilePath, checkPath);
            filePathExists = exists;
        } catch (e) {
            if (e?.message?.includes('PathNotFoundException')) {
                console.debug(`🔍 File path not found (expected): ${fullFilePath}`);
            } else {
                console.error(`❌ Unexpected error checking file path: ${fullFilePath}`, e);
            }
        }

        // Now create if needed
        if (!contentPathExists) {
            console.info(`📁 Creating content path: ${fullContentPath}`);
            await ensurePathExists(fullContentPath, 'jnt:contentFolder', checkPath, createPath);
        } else {
            console.info(`✅ Content path exists: ${fullContentPath}`);
        }

        if (!filePathExists) {
            console.info(`📁 Creating file path: ${fullFilePath}`);
            await ensurePathExists(fullFilePath, 'jnt:folder', checkPath, createPath);
        } else {
            console.info(`✅ File path exists: ${fullFilePath}`);
        }

        console.groupEnd();
        // === END Pre-import Validation ===

        const errorReport = [];
        let successCount = 0;
        let skippedCount = 0;
        let imageSuccessCount = 0;
        let imageFailCount = 0;
        let categorySuccessCount = 0;
        let categoryFailCount = 0;
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
                }
            };
        };

        try {
            if (!previewData) {
                alert('Please upload a valid JSON file.');
                return;
            }

            if (!isValidJson) {
                alert('Please upload a valid JSON file.');
                return;
            }

            if (!selectedContentType) {
                alert('Please select a content type.');
                return;
            }

            const propertyDefinitions = properties;

            if (!Array.isArray(previewData)) {
                alert('JSON file format is invalid or not properly parsed.');
                console.error('jsonPreview is not an array:', previewData);
                return;
            }

            const normalizeName = value =>
                value
                    .normalize('NFD') // Split accents from letters
                    .replace(/[\u0300-\u036f]/g, '') // Remove accents
                    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
                    .replace(/\s+/g, '_') // Replace spaces with underscores
                    .toLowerCase();

            for (const mappedEntry of previewData) {
                const contentName = mappedEntry['jcr:title'] ?
                    normalizeName(mappedEntry['jcr:title']) :
                    mappedEntry.name ?
                        normalizeName(mappedEntry.name) :
                        `content_${new Date().getTime()}`;
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

                let contentUuid = null;
                try {
                    if (exists && overrideExisting) {
                        const {data: updateData} = await updateContent({
                            variables: {
                                pathOrId: existingUuid,
                                properties: propertiesToSend
                            }
                        });
                        contentUuid = updateData?.jcr?.mutateNode?.uuid || existingUuid;
                        nodeReport.status = 'updated';
                        console.info(`Content updated: ${fullNodePath}`);
                    } else {
                        const {data: contentData} = await createContent({
                            variables: {
                                path: fullContentPath,
                                name: contentName,
                                primaryNodeType: selectedContentType,
                                properties: propertiesToSend
                            }
                        });
                        contentUuid = contentData?.jcr?.addNode?.uuid;
                        nodeReport.status = 'created';
                        if (contentUuid) {
                            console.info(`Content created: ${fullNodePath}`);
                        }
                    }

                    if (contentUuid) {
                        successCount++;
                    }
                } catch (error) {
                    nodeReport.status = 'failed';
                    errorReport.push({
                        node: `${fullContentPath}/${contentName}`,
                        reason: 'Mutation error',
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

                if (contentUuid) {
                    try {
                        const cleanUrl = `/${pathSuffix.trim()}/${contentName.replace(/_/g, '-')}`;
                        await addVanityUrl({variables: {pathOrId: contentUuid, language: selectedLanguage, url: cleanUrl}});
                    } catch (error) {
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
                            <Button
                                label={t('label.selectFolder')}
                                onClick={handleOpenPathPicker}
                            />
                        </div>
                        <Typography variant="body" className={`${styles.baseContentPath} ${styles.baseContentPathHelp}`}>
                            {t('label.enterPathSuffixHelp')}
                        </Typography>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={overrideExisting}
                                    sx={{'&.Mui-checked': {color: 'var(--color-accent)'}}}
                                    onChange={e => setOverrideExisting(e.target.checked)}
                                />
                            }
                            className={styles.overrideExisting}
                            label={t('label.overrideExisting')}
                        />
                        <LanguageSelector
                            languages={siteLanguages}
                            selectedLanguage={selectedLanguage}
                            error={languageError}
                            t={t}
                            onChange={setSelectedLanguage}
                        />
                        <Typography variant="heading" className={styles.heading}>
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
                        <PropertiesList properties={properties} error={propertiesError} t={t}/>
                    </div>

                    <div className={styles.rightPanel}>
                        <Tabs
                        value={activeTab}
                        className={styles.tabs}
                        TabIndicatorProps={{style: {backgroundColor: 'var(--color-accent)'}}}
                        onChange={handleTabChange}
                        >
                            <Tab
                            className={styles.tab}
                            variant="heading"
                            label={<Typography>{t('label.manualMapping')}</Typography>}
                        />
                            <Tab
                            className={styles.tab}
                            variant="heading"
                            label={<Typography>{t('label.reImportGeneratedFile')}</Typography>}
                        />
                        </Tabs>
                        {activeTab === 0 && (
                        <div className={styles.tabContent}>
                            <Typography variant="heading" className={styles.heading}>
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
                            <Typography variant="heading" className={styles.heading}>
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
            <Dialog fullWidth open={isFilePreviewOpen} maxWidth="md" onClose={() => setIsFilePreviewOpen(false)}>
                <DialogTitle>{t('label.filePreviewTitle')}</DialogTitle>
                <DialogContent dividers>
                    <pre className={styles.previewContent}>{JSON.stringify(uploadedFileContent, null, 2)}</pre>
                </DialogContent>
                <DialogActions>
                    <Button label={t('label.close')} onClick={() => setIsFilePreviewOpen(false)}/>
                </DialogActions>
            </Dialog>
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
