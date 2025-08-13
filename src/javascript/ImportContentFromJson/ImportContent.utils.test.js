import {generatePreviewData, extractFileFields} from './ImportContent.utils.js';

describe('generatePreviewData extra fields', () => {
    test('maps and parses tag and category fields', () => {
        const uploaded = [{title: 'T', tags: 'tag1, tag2', cats: 'cat1'}];
        const fieldMappings = {'jcr:title': 'title', 'j:tagList': 'tags', 'j:defaultCategory': 'cats'};
        const properties = [{name: 'jcr:title'}];

        const res = generatePreviewData(uploaded, fieldMappings, properties, ['j:tagList', 'j:defaultCategory']);
        expect(res[0]['jcr:title']).toBe('T');
        expect(res[0]['j:tagList']).toEqual(['tag1', 'tag2']);
        expect(res[0]['j:defaultCategory']).toEqual(['cat1']);
    });

    test('fallback to property name and ensure arrays', () => {
        const uploaded = [{}];
        const fieldMappings = {};
        const properties = [];

        const res = generatePreviewData(uploaded, fieldMappings, properties, ['j:tagList', 'j:defaultCategory']);
        expect(res[0]['j:tagList']).toEqual([]);
        expect(res[0]['j:defaultCategory']).toEqual([]);
    });

    test('reads value from property name when mapping missing', () => {
        const uploaded = [{'j:tagList': 'a; b', 'j:defaultCategory': 'cat'}];
        const fieldMappings = {};

        const res = generatePreviewData(uploaded, fieldMappings, [], ['j:tagList', 'j:defaultCategory']);
        expect(res[0]['j:tagList']).toEqual(['a', 'b']);
        expect(res[0]['j:defaultCategory']).toEqual(['cat']);
    });
});

describe('generatePreviewData basic tag handling', () => {
    test('comma separated strings become arrays', () => {
        const uploaded = [{tags: 'a,b,c'}];
        const fieldMappings = {'j:tagList': 'tags'};

        const res = generatePreviewData(uploaded, fieldMappings, [], ['j:tagList']);
        expect(res[0]['j:tagList']).toEqual(['a', 'b', 'c']);
    });

    test('missing values produce empty arrays', () => {
        const uploaded = [{}];
        const fieldMappings = {'j:tagList': 'tags'};

        const res = generatePreviewData(uploaded, fieldMappings, [], ['j:tagList']);
        expect(res[0]['j:tagList']).toEqual([]);
    });

    test('custom field mappings are respected', () => {
        const uploaded = [{customTags: 'x,y'}];
        const fieldMappings = {'j:tagList': 'customTags'};

        const res = generatePreviewData(uploaded, fieldMappings, [], ['j:tagList']);
        expect(res[0]['j:tagList']).toEqual(['x', 'y']);
    });

    test('json array strings become arrays', () => {
        const uploaded = [{tags: '[]'}];
        const fieldMappings = {'j:tagList': 'tags'};

        const res = generatePreviewData(uploaded, fieldMappings, [], ['j:tagList']);
        expect(res[0]['j:tagList']).toEqual([]);
    });
});

describe('generatePreviewData mapping removal', () => {
    test('ignores properties explicitly unmapped', () => {
        const uploaded = [{title: 'T'}];
        const fieldMappings = {'jcr:title': null};
        const properties = [{name: 'jcr:title'}];

        const res = generatePreviewData(uploaded, fieldMappings, properties);
        expect(res[0]['jcr:title']).toBeUndefined();
    });

    test('unmapped extra fields produce empty arrays', () => {
        const uploaded = [{'j:tagList': 'a,b'}];
        const fieldMappings = {'j:tagList': null};

        const res = generatePreviewData(uploaded, fieldMappings, [], ['j:tagList']);
        expect(res[0]['j:tagList']).toEqual([]);
    });
});

describe('generatePreviewData multiple property handling', () => {
    test('wraps single values into arrays for multiple properties', () => {
        const uploaded = [{options: 'swimmingPool'}];
        const fieldMappings = {options: 'options'};
        const properties = [{name: 'options', multiple: true}];

        const res = generatePreviewData(uploaded, fieldMappings, properties);
        expect(res[0].options).toEqual(['swimmingPool']);
    });

    test('parses json array strings for multiple properties', () => {
        const uploaded = [{options: '["a","b"]'}];
        const fieldMappings = {options: 'options'};
        const properties = [{name: 'options', multiple: true}];

        const res = generatePreviewData(uploaded, fieldMappings, properties);
        expect(res[0].options).toEqual(['a', 'b']);
    });
});

describe('generatePreviewData nested field handling', () => {
    test('maps value from nested path using dot notation', () => {
        const uploaded = [{properties: {subtitle: 'Nested'}}];
        const fieldMappings = {subtitle: 'properties.subtitle'};
        const properties = [{name: 'subtitle'}];

        const res = generatePreviewData(uploaded, fieldMappings, properties);
        expect(res[0].subtitle).toBe('Nested');
    });
});

describe('nested array field extraction and mapping', () => {
    test('extracts nested keys from arrays of objects', () => {
        const obj = {properties: [{subtitle: 'Nested'}]};
        const fields = extractFileFields(obj);
        expect(fields).toContain('properties.subtitle');
    });

    test('maps value from array using dot notation', () => {
        const uploaded = [{properties: [{subtitle: 'FromArray'}]}];
        const fieldMappings = {subtitle: 'properties.subtitle'};
        const properties = [{name: 'subtitle'}];

        const res = generatePreviewData(uploaded, fieldMappings, properties);
        expect(res[0].subtitle).toBe('FromArray');
    });
});
