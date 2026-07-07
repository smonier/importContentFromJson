import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
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
    PublishNode,
    GET_SITE_LANGUAGES
} from '~/gql-queries/ImportContent.gql-queries';
import {runImport} from '~/ImportContentFromJson/ImportEngine';

import {
    Button,
    Header,
    Dropdown,
    Typography,
    Input,
    Paper,
    Banner,
    Field,
    Fieldset,
    Checkbox,
    Tab,
    TabItem,
    Loader,
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter
} from '@jahia/moonstone';
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
    generatePreviewData,
    extractFileFields
} from '~/ImportContentFromJson/ImportContent.utils.js';
import {
    validateFile,
    validateArraySize
} from '~/ImportContentFromJson/ImportContent.validation';
import logger from '~/ImportContentFromJson/ImportContent.logger';
import {ERROR_MESSAGES} from '~/ImportContentFromJson/ImportContent.constants';

/**
 * A Moonstone Checkbox paired with a clickable Typography label.
 * `onChange` receives the new checked boolean.
 */
const LabeledCheckbox = ({checked, label, onChange}) => (
    <label className={styles.checkboxRow}>
        <Checkbox checked={checked} onChange={(event, value, isChecked) => onChange(isChecked)}/>
        <Typography variant="body">{label}</Typography>
    </label>
);

LabeledCheckbox.propTypes = {
    checked: PropTypes.bool,
    label: PropTypes.string,
    onChange: PropTypes.func
};

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
    // Dismissible page-level feedback (replaces the old alert() calls).
    const [banner, setBanner] = useState(null);
    const showError = message => setBanner({variant: 'danger', message});

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
    const siteKey = window.contextJsParameters?.siteKey;
    const baseContentPath = `/sites/${siteKey}/contents`;
    const baseFilePath = `/sites/${siteKey}/files`;
    const [pathSuffix, setPathSuffix] = useState('');

    // Override existing content option
    const [overrideExisting, setOverrideExisting] = useState(false);
    const [createVanityUrl, setCreateVanityUrl] = useState(true);
    // Publish imported content (and referenced files) to the live workspace.
    const [publishAfterImport, setPublishAfterImport] = useState(true);

    // --- Languages ----------------------------------------------------------
    const initialLanguage = window.contextJsParameters?.uilang;
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
    const [publishNode] = useMutation(PublishNode, {
        onError: error => {
            logger.error('PublishNode error', {error: error.message});
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
            showError(validation.error);
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
                        showError(sizeValidation.error);
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
                        showError(sizeValidation.error);
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
                showError(ERROR_MESSAGES.INVALID_JSON);
            }
        };

        reader.onerror = () => {
            console.error('Error reading file');
            showError('Error reading file. Please try again.');
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
            showError(t('label.invalidFile'));
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
                showError('Invalid file.');
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
                showError(ERROR_MESSAGES.NO_FILE_UPLOADED);
            } else if (!selectedContentType) {
                showError(ERROR_MESSAGES.NO_CONTENT_TYPE);
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

        const config = {
            pathSuffix,
            baseContentPath,
            baseFilePath,
            selectedContentType,
            selectedContentTypeOption: contentTypes.find(type => type.value === selectedContentType),
            selectedLanguage,
            overrideExisting,
            createVanityUrl,
            publishAfterImport,
            propertyDefinitions: properties,
            tagListField: TAG_LIST_FIELD,
            defaultCategoryField: DEFAULT_CATEGORY_FIELD
        };

        const ops = {
            checkPath,
            createPath,
            createContent,
            updateContent,
            checkImageExists,
            addFileToJcr,
            addTags,
            addCategories,
            checkIfCategoryExists,
            addVanityUrl,
            publishNode
        };

        try {
            const result = await runImport({previewData, isValidJson, config, ops, t});

            if (!result.ok) {
                const message = result.message || ERROR_MESSAGES[result.error] || ERROR_MESSAGES.UNKNOWN_ERROR;
                showError(message);
                return;
            }

            setReport(result.reportData);
            setIsReportOpen(true);
        } catch (error) {
            logger.error('Error during import', {error: error.message});
            showError(ERROR_MESSAGES.UNKNOWN_ERROR);
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
        if (!window.CE_API?.openPicker) {
            logger.error('CE_API.openPicker is not available in this host');
            return;
        }

        const initialPath = pathSuffix ? `${baseContentPath}/${pathSuffix}` : baseContentPath;

        window.CE_API.openPicker({
            type: 'editorial',
            initialSelectedItem: [initialPath],
            site: window.jahiaGWTParameters?.siteKey,
            lang: window.jahiaGWTParameters?.uilang,
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
                    <Loader size="big"/>
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
                {banner && (
                    <div className={styles.bannerRegion}>
                        <Banner
                            variant={banner.variant}
                            title={t('label.errorTitle')}
                        >
                            <div className={styles.bannerBody}>
                                <Typography variant="body">{banner.message}</Typography>
                                <Button variant="ghost" size="small" label={t('label.dismiss')} onClick={() => setBanner(null)}/>
                            </div>
                        </Banner>
                    </div>
                )}
                <div className={styles.container}>
                    <Paper className={styles.leftPanel}>
                        <Field
                            id="importPathField"
                            label={t('label.path')}
                            helper={`${baseContentPath}/  ·  ${t('label.enterPathSuffixHelp')}`}
                            buttons={<Button label={t('label.selectFolder')} onClick={handleOpenPathPicker}/>}
                        >
                            <Input
                                value={pathSuffix}
                                placeholder={t('label.enterPathSuffix')}
                                onChange={e => setPathSuffix(e.target.value)}
                            />
                        </Field>
                        <Fieldset id="importOptionsFieldset" label={t('label.options')}>
                            <LabeledCheckbox
                                checked={overrideExisting}
                                label={t('label.overrideExisting')}
                                onChange={setOverrideExisting}
                            />
                            <LabeledCheckbox
                                checked={createVanityUrl}
                                label={t('label.createVanityUrl')}
                                onChange={setCreateVanityUrl}
                            />
                            <LabeledCheckbox
                                checked={publishAfterImport}
                                label={t('label.publishAfterImport')}
                                onChange={setPublishAfterImport}
                            />
                        </Fieldset>
                        <LanguageSelector
                            languages={siteLanguages}
                            selectedLanguage={selectedLanguage}
                            error={languageError}
                            t={t}
                            onChange={setSelectedLanguage}
                        />
                        <Field
                            id="contentTypeField"
                            label={t('label.selectContentType')}
                            hasError={Boolean(contentTypeError)}
                            errorMessage={contentTypeError ? t('label.loadContentTypesError') : undefined}
                        >
                            <Dropdown
                                data={contentTypes}
                                value={selectedContentType}
                                placeholder={t('label.selectPlaceholder')}
                                onChange={(e, item) => handleContentTypeChange(item.value)}
                            />
                        </Field>
                        {selectedContentType && (
                            <PropertiesList properties={properties} error={propertiesError} t={t}/>
                        )}
                    </Paper>

                    <Paper className={styles.rightPanel}>
                        <Tab>
                            <TabItem
                                label={t('label.manualMapping')}
                                isSelected={activeTab === 0}
                                onClick={() => handleTabChange(null, 0)}
                            />
                            <TabItem
                                label={t('label.reImportGeneratedFile')}
                                isSelected={activeTab === 1}
                                onClick={() => handleTabChange(null, 1)}
                            />
                        </Tab>
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
                                <Banner variant="danger" title={t('label.errorTitle')} className={styles.inlineBanner}>
                                    <Typography variant="body">{generatedFileError}</Typography>
                                </Banner>
                            )}
                            {generatedFileContent && (
                                <pre className={styles.previewContent}>{JSON.stringify(generatedFileContent, null, 2)}</pre>
                            )}
                        </div>
                    )}
                    </Paper>
                </div>
            </div>
            <Modal
                isOpen={isFilePreviewOpen}
                size="large"
                onOpenChange={open => !open && setIsFilePreviewOpen(false)}
            >
                <>
                    <ModalHeader title={t('label.filePreviewTitle')}/>
                    <ModalBody>
                        <pre className={styles.previewContent}>{JSON.stringify(uploadedFileContent, null, 2)}</pre>
                    </ModalBody>
                    <ModalFooter>
                        <Button label={t('label.close')} onClick={() => setIsFilePreviewOpen(false)}/>
                    </ModalFooter>
                </>
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
