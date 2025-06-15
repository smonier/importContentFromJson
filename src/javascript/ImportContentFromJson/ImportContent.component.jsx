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
    AddVanityUrl,
    GET_SITE_LANGUAGES
} from '~/gql-queries/ImportContent.gql-queries';
import {handleMultipleImages, handleMultipleValues, handleSingleImage} from '~/Services/Services';

import {Button, Header, Dropdown, Typography, Input} from '@jahia/moonstone';
import {Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab} from '@mui/material';

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
    nodeExists
} from '~/ImportContentFromJson/ImportContent.utils.js';

export default () => {
    const {t} = useTranslation('importContentFromJson');

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

    // --- Languages ----------------------------------------------------------
    const initialLanguage = window.contextJsParameters.uilang;
    const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);
    const [siteLanguages, setSiteLanguages] = useState([]);
    const [languageError, setLanguageError] = useState(null);

    // GraphQL Queries and Mutations
    const [fetchContentTypes, {data: contentTypeData}] = useLazyQuery(GetContentTypeQuery, {
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
        onError: error => {
            if (error.message.includes('javax.jcr.ItemExistsException') || error.message.includes('already exists')) {
                console.info('CreateContent skipped - node already exists');
            } else {
                console.error('CreateContent error', error);
            }
        }
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
    const [fetchSiteLanguages, {data: siteLanguagesData}] = useLazyQuery(GET_SITE_LANGUAGES, {
        variables: {workspace: 'EDIT', scope: `/sites/${siteKey}`},
        fetchPolicy: 'network-only',
        onError: error => {
            console.error('GetSiteLanguages error', error);
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
        }

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
                    setFileFields(Object.keys(firstItem || {}));
                    setIsValidJson(false); // Structure validation will set to true
                }
            } catch (error) {
                console.error('Error parsing file:', error);
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
                const invalidKeys = jsonKeys.filter(k => !allowedKeys.includes(k) && k !== 'j:tagList' && k !== 'j:defaultCategory');
                if (invalidKeys.length > 0) {
                    console.warn('❌ Invalid properties found in uploaded JSON:', invalidKeys);
                } else {
                    console.info('✅ All properties valid');
                }

                console.groupEnd();
                // === END JSON Structure Validation ===

                const fileProps = Object.keys(firstItem || {});
                const allowed = properties.map(p => p.name);
                const invalid = fileProps.filter(p => !allowed.includes(p) && p !== 'j:tagList' && p !== 'j:defaultCategory');

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

    const handleImport = () => {
        console.log('Import button clicked - manual mapping');
        // Only run validation if structure has not been validated
        if (!isValidJson) {
            if (!uploadedFileContent || !selectedContentType) {
                if (!uploadedFileContent) {
                    alert('Please upload a valid JSON file.');
                } else if (!selectedContentType) {
                    alert('Please select a content type.');
                }

                return;
            }

            // Structure validation: check if uploadedFileContent matches properties
            const firstItem = Array.isArray(uploadedFileContent) ? uploadedFileContent[0] : uploadedFileContent;
            if (!firstItem || typeof firstItem !== 'object') {
                alert('Please upload a valid JSON file.');
                return;
            }

            const allowedKeys = properties.map(p => p.name);
            const jsonKeys = Object.keys(firstItem || {});
            const invalidKeys = jsonKeys.filter(k => !allowedKeys.includes(k) && k !== 'j:tagList' && k !== 'j:defaultCategory');
            if (invalidKeys.length > 0) {
                alert('Please upload a valid JSON file.');
                return;
            }

            setIsValidJson(true);
        }

        const preview = generatePreviewData(uploadedFileContent, fieldMappings, properties);
        setJsonPreview(preview);
        setIsPreviewOpen(true);
    };

    const startImport = async (previewData = jsonPreview) => {
        console.log('Starting import');
        setIsLoading(true);
        const fullContentPath = pathSuffix ? `${baseContentPath}/${pathSuffix.trim()}` : baseContentPath;
        const fullFilePath = pathSuffix ? `${baseFilePath}/${pathSuffix.trim()}` : baseFilePath;

        // === Pre-import Validation ===
        console.group('=== Pre-import Validation ===');
        const contentPathExists = await nodeExists(fullContentPath, checkPath);
        const filePathExists = await nodeExists(fullFilePath, checkPath);

        if (!contentPathExists) {
            console.info(`📁 Content path does not exist. Creating: ${fullContentPath}`);
            await ensurePathExists(fullContentPath, 'jnt:contentFolder', checkPath, createPath);
        } else {
            console.info(`📁 Content path exists: ${fullContentPath}`);
        }

        if (!filePathExists) {
            console.info(`📁 File path does not exist. Creating: ${fullFilePath}`);
            await ensurePathExists(fullFilePath, 'jnt:folder', checkPath, createPath);
        } else {
            console.info(`📁 File path exists: ${fullFilePath}`);
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
        const reportData = {nodes: [], images: [], categories: []};

        try {
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

            for (const mappedEntry of previewData) {
                const contentName = mappedEntry['jcr:title'] ?
                    mappedEntry['jcr:title'].replace(/\s+/g, '_').toLowerCase() :
                    mappedEntry.name ?
                        mappedEntry.name.replace(/\s+/g, '_').toLowerCase() :
                        `content_${new Date().getTime()}`;
                const fullNodePath = `${fullContentPath}/${contentName}`;
                const nodeReport = {name: fullNodePath, status: 'created'};

                const exists = await nodeExists(fullNodePath, checkPath);
                if (exists) {
                    reportData.nodes.push({name: fullNodePath, status: 'already exists'});
                    skippedCount++;
                    continue;
                }

                const imageResultsBuffer = [];
                const categoryResultsBuffer = [];

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
                    const {data: contentData} = await createContent({
                        variables: {
                            path: fullContentPath,
                            name: contentName,
                            primaryNodeType: selectedContentType,
                            properties: propertiesToSend
                        }
                    });
                    contentUuid = contentData?.jcr?.addNode?.uuid;
                    if (contentUuid) {
                        successCount++;
                    }
                } catch (error) {
                    let reason = 'Other error';
                    let details = error.message;

                    if (error.message.includes('javax.jcr.ItemExistsException') || error.message.includes('already exists')) {
                        reason = 'Node already exists';
                        details = ''; // No need to show stack trace for expected conflict
                        skippedCount++;
                    }

                    nodeReport.status = reason === 'Node already exists' ? 'already exists' : 'failed';
                    errorReport.push({
                        node: `${fullContentPath}/${contentName}`,
                        reason,
                        details
                    });
                    reportData.nodes.push(nodeReport);
                    continue;
                }

                reportData.nodes.push(nodeReport);

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
                            try {
                                await addCategories({variables: {path: contentUuid, categories: defaultCategoryUuids}});
                                categorySuccessCount += defaultCategoryUuids.length;
                                mappedEntry['j:defaultCategory'].forEach(cat => {
                                    categoryResultsBuffer.push({name: cat, status: 'created', node: nodeReport.name});
                                });
                            } catch (err) {
                                categoryFailCount += defaultCategoryUuids.length;
                                mappedEntry['j:defaultCategory'].forEach(cat => {
                                    categoryResultsBuffer.push({name: cat, status: 'failed', node: nodeReport.name});
                                });
                                errorReport.push({node: contentName, reason: 'Error adding categories', details: err.message});
                            }
                        } else {
                            categoryFailCount += (mappedEntry['j:defaultCategory'] || []).length;
                            (mappedEntry['j:defaultCategory'] || []).forEach(cat => {
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
            const totalAttempts = previewData.length;
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

            setReport(reportData);
            setIsReportOpen(true);
        } catch (error) {
            console.error('Error during import:', error);
            reportData.nodes.push({name: 'import', status: 'failed'});
            setReport(reportData);
            setIsReportOpen(true);
        } finally {
            setIsLoading(false);
            setIsPreviewOpen(false);
        }
    };

    const handleDownloadJson = () => {
        console.log('Download button clicked');
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

    const importGeneratedFile = () => {
        console.log('Import button clicked - re-import');
        if (!generatedFileContent) {
            return;
        }

        setJsonPreview(generatedFileContent);
        // Use local variable to avoid stale state issues
        startImport(generatedFileContent);
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
                        label={t('label.importFromJson')}
                        onClick={activeTab === 0 ? handleImport : importGeneratedFile}
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
                previewData={jsonPreview}
                t={t}
                onClose={() => setIsPreviewOpen(false)}
                onDownload={handleDownloadJson}
                onStart={startImport}
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
