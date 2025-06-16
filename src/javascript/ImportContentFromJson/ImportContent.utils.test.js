import {generatePreviewData} from './ImportContent.utils.js';

describe('generatePreviewData extra fields', () => {
    test('maps and parses tag and category fields', () => {
        const uploaded = [{title: 'T', tags: 'tag1, tag2', cats: 'cat1'}];
        const fieldMappings = { 'jcr:title': 'title', 'j:tagList': 'tags', 'j:defaultCategory': 'cats' };
        const properties = [{name: 'jcr:title'}];

        const res = generatePreviewData(uploaded, fieldMappings, properties, ['j:tagList', 'j:defaultCategory']);
        expect(res[0]['jcr:title']).toBe('T');
        expect(res[0]['j:tagList']).toEqual(['tag1', 'tag2']);
        expect(res[0]['j:defaultCategory']).toEqual(['cat1']);
    });

    test('fallback to property name and ensure arrays', () => {
        const uploaded = [{ }];
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
