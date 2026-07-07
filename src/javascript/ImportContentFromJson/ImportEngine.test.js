import {runImport} from './ImportEngine';

/**
 * Build a set of injected ops with sensible defaults. `existingPaths` marks
 * paths that checkPath should report as already existing (with a uuid).
 */
const buildOps = ({existingPaths = new Set(), overrides = {}} = {}) => {
    let uuidCounter = 0;
    const nextUuid = () => `uuid-${++uuidCounter}`;

    const checkPath = jest.fn(async ({variables: {path}}) => {
        if (existingPaths.has(path)) {
            return {data: {jcr: {nodeByPath: {uuid: `existing-${path}`, path}}}};
        }

        return {data: {jcr: {nodeByPath: null}}};
    });

    return {
        checkPath,
        createPath: jest.fn(async () => ({data: {jcr: {addNode: {uuid: nextUuid()}}}})),
        createContent: jest.fn(async () => ({data: {jcr: {addNode: {uuid: nextUuid()}}}})),
        updateContent: jest.fn(async () => ({data: {jcr: {mutateNode: {uuid: nextUuid()}}}})),
        checkImageExists: jest.fn(async () => ({data: {jcr: {nodeByPath: null}}})),
        addFileToJcr: jest.fn(async () => ({data: {jcr: {addNode: {uuid: nextUuid()}}}})),
        addTags: jest.fn(async () => ({data: {}})),
        addCategories: jest.fn(async () => ({data: {}})),
        checkIfCategoryExists: jest.fn(async () => ({data: {jcr: {nodeByPath: {children: {nodes: []}}}}})),
        addVanityUrl: jest.fn(async () => ({data: {}})),
        publishNode: jest.fn(async () => ({data: {}})),
        ...overrides
    };
};

const baseConfig = (over = {}) => ({
    pathSuffix: '',
    baseContentPath: '/sites/test/contents',
    baseFilePath: '/sites/test/files',
    selectedContentType: 'jnt:article',
    selectedContentTypeOption: {value: 'jnt:article', label: 'Article'},
    selectedLanguage: 'en',
    overrideExisting: false,
    createVanityUrl: false,
    publishAfterImport: false,
    propertyDefinitions: [
        {name: 'jcr:title', requiredType: 'STRING', internationalized: true},
        {name: 'body', requiredType: 'STRING', internationalized: true}
    ],
    tagListField: 'j:tagList',
    defaultCategoryField: 'j:defaultCategory',
    ...over
});

const t = key => key;

const run = (previewData, config, ops) => runImport({
    previewData,
    isValidJson: true,
    config: baseConfig(config),
    ops: ops || buildOps(),
    t
});

describe('runImport - guard clauses', () => {
    it('rejects a missing file', async () => {
        const res = await runImport({previewData: null, isValidJson: true, config: baseConfig(), ops: buildOps(), t});
        expect(res).toEqual({ok: false, error: 'NO_FILE_UPLOADED'});
    });

    it('rejects unvalidated JSON', async () => {
        const res = await runImport({previewData: [], isValidJson: false, config: baseConfig(), ops: buildOps(), t});
        expect(res).toEqual({ok: false, error: 'INVALID_JSON'});
    });

    it('rejects when no content type is selected', async () => {
        const res = await runImport({previewData: [], isValidJson: true, config: baseConfig({selectedContentType: null}), ops: buildOps(), t});
        expect(res).toEqual({ok: false, error: 'NO_CONTENT_TYPE'});
    });

    it('rejects non-array preview data', async () => {
        const res = await runImport({previewData: {a: 1}, isValidJson: true, config: baseConfig(), ops: buildOps(), t});
        expect(res).toEqual({ok: false, error: 'INVALID_JSON'});
    });

    it('rejects an invalid path without creating folders', async () => {
        const ops = buildOps();
        const res = await runImport({previewData: [{'jcr:title': 'A'}], isValidJson: true, config: baseConfig({pathSuffix: '../evil'}), ops, t});
        expect(res.ok).toBe(false);
        expect(res.error).toBe('INVALID_PATH');
        expect(ops.createPath).not.toHaveBeenCalled();
        expect(ops.createContent).not.toHaveBeenCalled();
    });
});

describe('runImport - create / update / skip', () => {
    it('creates a node per entry and reports created count', async () => {
        const ops = buildOps();
        const res = await run([{'jcr:title': 'First', body: 'x'}, {'jcr:title': 'Second', body: 'y'}], {}, ops);

        expect(res.ok).toBe(true);
        expect(ops.createContent).toHaveBeenCalledTimes(2);
        expect(res.reportData.summary.nodes.created).toBe(2);
        expect(res.reportData.summary.nodes.total).toBe(2);
        expect(res.reportData.summary.nodes.failed).toBe(0);
    });

    it('sends the mapped properties to createContent', async () => {
        const ops = buildOps();
        await run([{'jcr:title': 'Hello', body: 'World'}], {}, ops);

        const {variables} = ops.createContent.mock.calls[0][0];
        expect(variables.name).toBe('hello');
        expect(variables.primaryNodeType).toBe('jnt:article');
        const titleProp = variables.properties.find(p => p.name === 'jcr:title');
        expect(titleProp).toMatchObject({value: 'Hello', language: 'en'});
    });

    it('skips an existing node when overrideExisting is false', async () => {
        const ops = buildOps({existingPaths: new Set(['/sites/test/contents/first'])});
        const res = await run([{'jcr:title': 'First'}], {}, ops);

        expect(ops.createContent).not.toHaveBeenCalled();
        expect(ops.updateContent).not.toHaveBeenCalled();
        expect(res.reportData.summary.nodes.skipped).toBe(1);
    });

    it('updates an existing node when overrideExisting is true', async () => {
        const ops = buildOps({existingPaths: new Set(['/sites/test/contents/first'])});
        const res = await run([{'jcr:title': 'First', body: 'z'}], {overrideExisting: true}, ops);

        expect(ops.updateContent).toHaveBeenCalledTimes(1);
        expect(ops.createContent).not.toHaveBeenCalled();
        expect(res.reportData.summary.nodes.updated).toBe(1);
    });

    it('reports a failure when the create mutation throws', async () => {
        const ops = buildOps({overrides: {createContent: jest.fn(() => Promise.reject(new Error('boom')))}});
        const res = await run([{'jcr:title': 'First'}], {}, ops);

        expect(res.ok).toBe(true);
        expect(res.reportData.summary.nodes.failed).toBe(1);
        expect(res.reportData.errors.some(e => e.reason === 'Content creation failed')).toBe(true);
    });
});

describe('runImport - node name de-duplication', () => {
    it('suffixes colliding node names instead of overwriting', async () => {
        const ops = buildOps();
        await run([{'jcr:title': 'Same'}, {'jcr:title': 'Same'}, {'jcr:title': 'Same'}], {}, ops);

        const names = ops.createContent.mock.calls.map(c => c[0].variables.name);
        expect(names).toEqual(['same', 'same-2', 'same-3']);
    });
});

describe('runImport - publication', () => {
    it('publishes created nodes when publishAfterImport is true', async () => {
        const ops = buildOps();
        const res = await run([{'jcr:title': 'A'}, {'jcr:title': 'B'}], {publishAfterImport: true}, ops);

        expect(ops.publishNode).toHaveBeenCalledTimes(2);
        expect(ops.publishNode.mock.calls[0][0].variables.languages).toEqual(['en']);
        expect(res.reportData.summary.publication).toEqual({enabled: true, published: 2, failed: 0});
    });

    it('does not publish when publishAfterImport is false', async () => {
        const ops = buildOps();
        await run([{'jcr:title': 'A'}], {publishAfterImport: false}, ops);
        expect(ops.publishNode).not.toHaveBeenCalled();
    });
});

describe('runImport - vanity URLs', () => {
    it('builds the vanity URL from the sanitized path', async () => {
        const ops = buildOps();
        await run([{'jcr:title': 'My Article'}], {createVanityUrl: true, pathSuffix: 'News/2025'}, ops);

        expect(ops.addVanityUrl).toHaveBeenCalledTimes(1);
        const {variables} = ops.addVanityUrl.mock.calls[0][0];
        expect(variables.url).toBe('/news/2025/my-article');
        expect(variables.language).toBe('en');
    });
});

describe('runImport - tags and categories', () => {
    it('adds tags from the tag list field', async () => {
        const ops = buildOps();
        await run([{'jcr:title': 'A', 'j:tagList': ['red', 'blue']}], {}, ops);

        expect(ops.addTags).toHaveBeenCalledTimes(1);
        expect(ops.addTags.mock.calls[0][0].variables.tags).toEqual(['red', 'blue']);
    });

    it('matches categories by system name from the category tree', async () => {
        const ops = buildOps({
            overrides: {
                checkIfCategoryExists: jest.fn(async () => ({
                    data: {jcr: {nodeByPath: {children: {nodes: [
                        {name: 'news', uuid: 'cat-news', children: {nodes: []}}
                    ]}}}}
                }))
            }
        });
        const res = await run([{'jcr:title': 'A', 'j:defaultCategory': ['News']}], {}, ops);

        expect(ops.addCategories).toHaveBeenCalledTimes(1);
        expect(ops.addCategories.mock.calls[0][0].variables.categories).toEqual(['cat-news']);
        expect(res.reportData.summary.categories.created).toBe(1);
    });
});
