import {handleSingleImage, handleMultipleImages} from './Services.jsx';

describe('image handlers', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(new Blob(['x'], {type: 'image/png'}))
        }));
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.clearAllMocks();
    });

    test('handleSingleImage accepts string url', async () => {
        const checkImageExists = jest.fn(() => Promise.resolve({data: {jcr: {nodeByPath: null}}}));
        const addFileToJcr = jest.fn(() => Promise.resolve({data: {jcr: {addNode: {uuid: 'uuid123'}}}}));

        const uuid = await handleSingleImage('http://example.com/img.png', 'img', checkImageExists, addFileToJcr, '/files', 'test');
        expect(uuid).toBe('uuid123');
        expect(fetch).toHaveBeenCalled();
    });

    test('handleMultipleImages accepts array of string urls', async () => {
        const checkImageExists = jest.fn(() => Promise.resolve({data: {jcr: {nodeByPath: null}}}));
        const addFileToJcr = jest.fn(() => Promise.resolve({data: {jcr: {addNode: {uuid: 'uuid1'}}}}));

        const uuids = await handleMultipleImages(['http://ex.com/a.png', 'http://ex.com/b.png'], 'imgs', {}, checkImageExists, addFileToJcr, '/files', 'test');
        expect(uuids).toEqual(['uuid1', 'uuid1']);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('handleMultipleImages accepts comma separated string', async () => {
        const checkImageExists = jest.fn(() => Promise.resolve({data: {jcr: {nodeByPath: null}}}));
        const addFileToJcr = jest.fn(() => Promise.resolve({data: {jcr: {addNode: {uuid: 'uuid2'}}}}));

        const uuids = await handleMultipleImages('http://ex.com/a.png; http://ex.com/b.png', 'imgs', {}, checkImageExists, addFileToJcr, '/files', 'test');
        expect(uuids).toEqual(['uuid2', 'uuid2']);
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});
