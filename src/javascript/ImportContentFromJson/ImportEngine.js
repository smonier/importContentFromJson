/**
 * ImportEngine — the pure import pipeline extracted from the React component.
 *
 * `runImport` is UI-agnostic and dependency-injected: it receives the GraphQL
 * operations (mutations/queries) and a translation function via `ops`/`t`, and
 * returns a structured result instead of touching React state or `alert()`.
 * This makes the core create/update/skip/publish logic unit-testable.
 *
 * Contract:
 *   runImport({previewData, isValidJson, config, ops, t})
 *     -> {ok: false, error: <ERROR_MESSAGES key-ish code>, message}
 *     -> {ok: true, reportData}
 *
 * `config` carries the plain values the component would otherwise close over
 * (paths, selected type/language, option flags, property definitions). `ops`
 * bundles the injected async functions (see ImportContent.component.jsx).
 */

import {
    ensurePathExists,
    flattenCategoryTree,
    nodeExists
} from './ImportContent.utils.js';
import {sanitizeNodeName, sanitizePath, validatePath} from './ImportContent.validation';
import {handleMultipleImages, handleMultipleValues, handleSingleImage} from '~/Services/Services';
import {processConcurrent} from './ImportContent.performance';
import {MAX_CONCURRENT_REQUESTS} from './ImportContent.constants';
import logger from './ImportContent.logger';

const IMAGE_CONSTRAINT = '{http://www.jahia.org/jahia/mix/1.0}image';
const EDITORIAL_MIXIN = 'jmix:editorialContent';

const isUrlLikeReference = refValue => {
    if (typeof refValue === 'string') {
        const normalized = refValue.trim().toLowerCase();
        return normalized.startsWith('http://') ||
            normalized.startsWith('https://') ||
            normalized.startsWith('file://') ||
            normalized === 'unsplash';
    }

    return typeof refValue?.url === 'string' && refValue.url.trim().length > 0;
};

/**
 * Build the run-level summary object from the accumulated report + stats.
 */
const buildSummary = (reportData, stats, config, t) => {
    const validNodeEntries = reportData.nodes.filter(item => item?.name && item.name !== 'import');

    const tallyStatus = (acc, status) => {
        if (status === 'created') {
            acc.created++;
        } else if (status === 'updated') {
            acc.updated++;
        } else if (status === 'already exists') {
            acc.skipped++;
        } else if (status === 'failed') {
            acc.failed++;
        }

        return acc;
    };

    const nodeSummary = validNodeEntries.reduce(
        (acc, item) => tallyStatus(acc, item.status),
        {created: 0, updated: 0, failed: 0, skipped: 0}
    );

    const imageSummary = reportData.images.reduce(
        (acc, item) => (item ? tallyStatus(acc, item.status) : acc),
        {created: 0, updated: 0, failed: 0, skipped: 0}
    );

    const categorySummary = reportData.categories.reduce((acc, item) => {
        if (!item) {
            return acc;
        }

        const categoryName = item.name || t('label.unknownCategory');

        if (item.status === 'created') {
            acc.created++;
            acc.createdByName[categoryName] = (acc.createdByName[categoryName] || 0) + 1;
        } else if (item.status === 'already exists') {
            acc.skipped++;
        } else if (item.status === 'failed') {
            acc.failed++;
        }

        return acc;
    }, {created: 0, failed: 0, skipped: 0, createdByName: {}});

    const vanitySkipped = config.createVanityUrl ?
        Math.max(stats.totalAttempts - (stats.vanitySuccessCount + stats.vanityFailCount), 0) :
        stats.totalAttempts;

    return {
        contentType: reportData.contentType,
        path: reportData.path,
        nodes: {
            processed: validNodeEntries.length,
            total: stats.totalAttempts,
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
            enabled: config.createVanityUrl,
            created: stats.vanitySuccessCount,
            failed: stats.vanityFailCount,
            skipped: vanitySkipped
        },
        publication: {
            enabled: config.publishAfterImport,
            published: stats.publishSuccessCount,
            failed: stats.publishFailCount
        }
    };
};

export const runImport = async ({previewData, isValidJson, config, ops, t}) => {
    const {
        pathSuffix = '',
        baseContentPath,
        baseFilePath,
        selectedContentType,
        selectedContentTypeOption,
        selectedLanguage,
        overrideExisting,
        createVanityUrl,
        publishAfterImport,
        propertyDefinitions = [],
        tagListField,
        defaultCategoryField,
        maxConcurrentUploads = MAX_CONCURRENT_REQUESTS
    } = config;

    const {
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
    } = ops;

    // --- Guard clauses (checked before any side-effecting folder creation) ---
    if (!previewData) {
        return {ok: false, error: 'NO_FILE_UPLOADED'};
    }

    if (!isValidJson) {
        return {ok: false, error: 'INVALID_JSON'};
    }

    if (!selectedContentType) {
        return {ok: false, error: 'NO_CONTENT_TYPE'};
    }

    if (!Array.isArray(previewData)) {
        logger.error('Invalid preview data format', {isArray: Array.isArray(previewData)});
        return {ok: false, error: 'INVALID_JSON'};
    }

    const pathValidation = validatePath(pathSuffix);
    if (!pathValidation.valid) {
        logger.error('Path validation failed', {error: pathValidation.error});
        return {ok: false, error: 'INVALID_PATH', message: pathValidation.error};
    }

    const sanitizedPath = sanitizePath(pathSuffix);
    const fullContentPath = sanitizedPath ? `${baseContentPath}/${sanitizedPath}` : baseContentPath;
    const fullFilePath = sanitizedPath ? `${baseFilePath}/${sanitizedPath}` : baseFilePath;

    // --- Pre-import: ensure target folders exist ---
    logger.group('=== Pre-import Validation ===');
    for (const [path, type] of [[fullContentPath, 'jnt:contentFolder'], [fullFilePath, 'jnt:folder']]) {
        let pathExists = false;
        try {
            // eslint-disable-next-line no-await-in-loop
            const {exists} = await nodeExists(path, checkPath);
            pathExists = exists;
        } catch (e) {
            if (e?.message?.includes('PathNotFoundException')) {
                logger.debug('Path not found (expected)', {path});
            } else {
                logger.error('Unexpected error checking path', {path, error: e.message});
            }
        }

        if (pathExists) {
            logger.debug('Path exists', {path});
        } else {
            logger.info('Creating path', {path, type});
            // eslint-disable-next-line no-await-in-loop
            await ensurePathExists(path, type, checkPath, createPath);
        }
    }

    logger.groupEnd();

    // --- Run state ---
    const errorReport = [];
    const stats = {
        successCount: 0,
        skippedCount: 0,
        imageSuccessCount: 0,
        imageFailCount: 0,
        categorySuccessCount: 0,
        categoryFailCount: 0,
        vanitySuccessCount: 0,
        vanityFailCount: 0,
        publishSuccessCount: 0,
        publishFailCount: 0,
        totalAttempts: previewData.length
    };

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

    // Per-run category cache (name -> uuid), loaded lazily once.
    const categoryCache = new Map();
    let categoriesFetched = false;
    const fetchCategoriesOnce = async () => {
        if (categoriesFetched) {
            return;
        }

        categoriesFetched = true;
        try {
            const {data} = await checkIfCategoryExists();
            if (data?.jcr?.nodeByPath?.children?.nodes) {
                flattenCategoryTree(data.jcr.nodeByPath.children.nodes, categoryCache);
            }
        } catch (error) {
            logger.error('GraphQL Category Fetch Error', {error: error.message});
        }
    };

    const usedNames = new Set();
    const nodesToPublish = [];

    for (const mappedEntry of previewData) {
        // Ensure a unique node name within this run (no silent overwrite/skip).
        let contentName = sanitizeNodeName(
            mappedEntry['jcr:title'] || mappedEntry.name || `content_${Date.now()}`
        );
        if (usedNames.has(contentName)) {
            let suffix = 2;
            while (usedNames.has(`${contentName}-${suffix}`)) {
                suffix++;
            }

            contentName = `${contentName}-${suffix}`;
        }

        usedNames.add(contentName);
        const fullNodePath = `${fullContentPath}/${contentName}`;
        const nodeReport = {name: fullNodePath, status: 'created'};

        // eslint-disable-next-line no-await-in-loop
        const {exists, uuid: existingUuid} = await nodeExists(fullNodePath, checkPath);
        if (exists && !overrideExisting) {
            reportData.nodes.push({name: fullNodePath, status: 'already exists'});
            stats.skippedCount++;
            errorReport.push({node: fullNodePath, reason: 'Node already exists', details: ''});
            continue;
        }

        const imageResultsBuffer = [];
        const categoryResultsBuffer = [];

        // Map a single JSON property key to an InputJCRProperty (or null to skip).
        const mapPropertyKey = async key => {
            if (key === tagListField || key === defaultCategoryField) {
                return null;
            }

            const propertyDefinition = propertyDefinitions.find(prop => prop.name === key);
            if (!propertyDefinition) {
                return null;
            }

            let value = mappedEntry[key];
            const isImage = propertyDefinition.constraints?.includes(IMAGE_CONSTRAINT);
            const isDate = propertyDefinition.requiredType === 'DATE';
            const isWeakReference = propertyDefinition.requiredType === 'WEAKREFERENCE';
            const isMultiple = propertyDefinition.multiple;
            const language = propertyDefinition?.internationalized ? selectedLanguage : undefined;

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
                    imgRes.forEach(r => imageResultsBuffer.push({name: r.name, status: r.status, node: nodeReport.name}));
                    stats.imageSuccessCount += imgRes.filter(r => r.status !== 'failed').length;
                    stats.imageFailCount += imgRes.filter(r => r.status === 'failed').length;
                    values = imgRes.map(r => r.uuid).filter(Boolean);
                } else if (isWeakReference) {
                    const normalizedValue = Array.isArray(value) ? value : [value];
                    const shouldUploadReferences = normalizedValue.some(item => isUrlLikeReference(item));
                    if (shouldUploadReferences) {
                        const weakRefResults = await handleMultipleImages(normalizedValue, key, propertyDefinition, checkImageExists, addFileToJcr, baseFilePath, pathSuffix.trim());
                        const successfulResults = weakRefResults.filter(r => r.status !== 'failed');
                        const failedResults = weakRefResults.filter(r => r.status === 'failed');
                        weakRefResults.forEach(r => imageResultsBuffer.push({name: r.name, status: r.status, node: nodeReport.name}));
                        stats.imageSuccessCount += successfulResults.length;
                        stats.imageFailCount += failedResults.length;
                        if (failedResults.length > 0) {
                            errorReport.push({node: contentName, reason: `${failedResults.length} weakreference file(s) failed to upload for ${key}`, details: ''});
                        }

                        values = successfulResults.map(r => r.uuid).filter(Boolean);
                        if (values.length === 0) {
                            return null;
                        }
                    } else {
                        values = handleMultipleValues(value, key);
                    }
                } else {
                    values = handleMultipleValues(value, key);
                }

                return {name: key, values: Array.isArray(values) ? values : [], language};
            }

            if (isImage) {
                try {
                    const imgRes = await handleSingleImage(value, key, checkImageExists, addFileToJcr, baseFilePath, pathSuffix.trim());
                    imageResultsBuffer.push({name: imgRes.name, status: imgRes.status, node: nodeReport.name});
                    if (imgRes.status === 'failed') {
                        stats.imageFailCount++;
                    } else {
                        stats.imageSuccessCount++;
                    }

                    return {name: key, value: imgRes.uuid, language};
                } catch (err) {
                    stats.imageFailCount++;
                    errorReport.push({node: contentName, reason: 'Image import failed', details: err.message});
                    return null;
                }
            }

            if (isWeakReference && isUrlLikeReference(value)) {
                try {
                    const weakRefRes = await handleSingleImage(value, key, checkImageExists, addFileToJcr, baseFilePath, pathSuffix.trim());
                    imageResultsBuffer.push({name: weakRefRes.name, status: weakRefRes.status, node: nodeReport.name});
                    if (weakRefRes.status === 'failed') {
                        stats.imageFailCount++;
                        errorReport.push({node: contentName, reason: `WeakReference file upload failed for ${key}`, details: `Could not fetch or process file: ${value.url || value}`});
                        return null;
                    }

                    stats.imageSuccessCount++;
                    return {name: key, value: weakRefRes.uuid, language};
                } catch (err) {
                    stats.imageFailCount++;
                    errorReport.push({node: contentName, reason: 'WeakReference import failed', details: err.message});
                    return null;
                }
            }

            return {name: key, value, language};
        };

        // Cap concurrent uploads so a node with many image properties does not
        // burst unbounded binary uploads at the server.
        // eslint-disable-next-line no-await-in-loop
        const mapped = await processConcurrent(Object.keys(mappedEntry), mapPropertyKey, maxConcurrentUploads);
        const propertiesToSend = mapped.filter(prop => prop && !prop.error);
        reportData.images.push(...imageResultsBuffer);

        // Determine required mixins based on properties being set.
        const requiredMixins = new Set([EDITORIAL_MIXIN]);
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
                // eslint-disable-next-line no-await-in-loop
                const {data: updateData} = await updateContent({
                    variables: {pathOrId: existingUuid, mixins: mixinsArray, properties: propertiesToSend}
                });
                contentUuid = updateData?.jcr?.mutateNode?.uuid || existingUuid;
                if (!contentUuid) {
                    throw new Error('Update mutation did not return a node UUID.');
                }

                nodeReport.status = 'updated';
                logger.info('Content updated', {path: fullNodePath});
            } else {
                // eslint-disable-next-line no-await-in-loop
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
                logger.info('Content created', {path: fullNodePath});
            }

            stats.successCount++;
        } catch (error) {
            const action = exists && overrideExisting ? 'update' : 'creation';
            nodeReport.status = 'failed';
            errorReport.push({node: `${fullContentPath}/${contentName}`, reason: `Content ${action} failed`, details: error.message});
            reportData.nodes.push(nodeReport);
            continue;
        }

        reportData.nodes.push(nodeReport);
        if (contentUuid) {
            nodesToPublish.push(contentUuid);
        }

        if (contentUuid && Array.isArray(mappedEntry[tagListField]) && mappedEntry[tagListField].length > 0) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await addTags({variables: {path: contentUuid, tags: mappedEntry[tagListField]}});
            } catch (error) {
                errorReport.push({node: `${fullContentPath}/${contentName}`, reason: 'Error adding tags', details: error.message});
            }
        }

        if (contentUuid && Array.isArray(mappedEntry[defaultCategoryField]) && mappedEntry[defaultCategoryField].length > 0) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await fetchCategoriesOnce();

                const defaultCategoryUuids = [];
                for (let categoryName of mappedEntry[defaultCategoryField]) {
                    categoryName = categoryName.toLowerCase().replace(/\s+/g, '-');
                    const categoryUuid = categoryCache.get(categoryName);
                    if (categoryUuid) {
                        defaultCategoryUuids.push(categoryUuid);
                    }
                }

                if (defaultCategoryUuids.length > 0) {
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        await addCategories({variables: {path: contentUuid, categories: defaultCategoryUuids}});
                        stats.categorySuccessCount += defaultCategoryUuids.length;
                        mappedEntry[defaultCategoryField].forEach(cat => categoryResultsBuffer.push({name: cat, status: 'created', node: nodeReport.name}));
                    } catch (err) {
                        stats.categoryFailCount += defaultCategoryUuids.length;
                        mappedEntry[defaultCategoryField].forEach(cat => categoryResultsBuffer.push({name: cat, status: 'failed', node: nodeReport.name}));
                        errorReport.push({node: contentName, reason: 'Error adding categories', details: err.message});
                    }
                } else {
                    stats.categoryFailCount += (mappedEntry[defaultCategoryField] || []).length;
                    (mappedEntry[defaultCategoryField] || []).forEach(cat => categoryResultsBuffer.push({name: cat, status: 'failed', node: nodeReport.name}));
                    errorReport.push({node: contentName, reason: 'No matching category UUID found', details: ''});
                }
            } catch (error) {
                errorReport.push({node: `${fullContentPath}/${contentName}`, reason: 'Error adding categories', details: error.message});
            }
        }

        reportData.categories.push(...categoryResultsBuffer);

        if (contentUuid && createVanityUrl) {
            try {
                const vanitySegment = sanitizedPath ? `/${sanitizedPath}` : '';
                const cleanUrl = `${vanitySegment}/${contentName.replace(/_/g, '-')}`;
                // eslint-disable-next-line no-await-in-loop
                await addVanityUrl({variables: {pathOrId: contentUuid, language: selectedLanguage, url: cleanUrl}});
                stats.vanitySuccessCount++;
            } catch (error) {
                stats.vanityFailCount++;
                errorReport.push({node: `${fullContentPath}/${contentName}`, reason: 'Error adding vanity URL', details: error.message});
            }
        }
    }

    // Optionally publish everything written (content + referenced files/images).
    if (publishAfterImport && nodesToPublish.length > 0) {
        logger.info('Publishing imported nodes', {count: nodesToPublish.length});
        for (const uuid of nodesToPublish) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await publishNode({variables: {pathOrId: uuid, languages: [selectedLanguage]}});
                stats.publishSuccessCount++;
            } catch (error) {
                stats.publishFailCount++;
                errorReport.push({node: uuid, reason: 'Publication failed', details: error.message});
            }
        }
    }

    const failedCount = errorReport.filter(e => e.reason !== 'Node already exists').length;
    const skippedNodes = errorReport.filter(e => e.reason === 'Node already exists').length;
    logger.info('Import summary', {
        success: stats.successCount,
        skipped: skippedNodes,
        failed: failedCount,
        images: {success: stats.imageSuccessCount, failed: stats.imageFailCount},
        categories: {success: stats.categorySuccessCount, failed: stats.categoryFailCount},
        published: {success: stats.publishSuccessCount, failed: stats.publishFailCount}
    });

    reportData.summary = buildSummary(reportData, stats, config, t);
    reportData.errors = errorReport;
    return {ok: true, reportData};
};
