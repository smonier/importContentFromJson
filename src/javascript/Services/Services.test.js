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

        const res = await handleSingleImage('http://example.com/img.png', 'img', checkImageExists, addFileToJcr, '/files', 'test');
        expect(res.uuid).toBe('uuid123');
        expect(res.status).toBe('created');
        expect(fetch).toHaveBeenCalled();
    });

    test('handleMultipleImages accepts array of string urls', async () => {
        const checkImageExists = jest.fn(() => Promise.resolve({data: {jcr: {nodeByPath: null}}}));
        const addFileToJcr = jest.fn(() => Promise.resolve({data: {jcr: {addNode: {uuid: 'uuid1'}}}}));

        const res = await handleMultipleImages(['http://ex.com/a.png', 'http://ex.com/b.png'], 'imgs', {}, checkImageExists, addFileToJcr, '/files', 'test');
        expect(res).toEqual([
            {uuid: 'uuid1', status: 'created', name: 'a.png'},
            {uuid: 'uuid1', status: 'created', name: 'b.png'}
        ]);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('handleMultipleImages accepts comma separated string', async () => {
        const checkImageExists = jest.fn(() => Promise.resolve({data: {jcr: {nodeByPath: null}}}));
        const addFileToJcr = jest.fn(() => Promise.resolve({data: {jcr: {addNode: {uuid: 'uuid2'}}}}));

        const res = await handleMultipleImages('http://ex.com/a.png; http://ex.com/b.png', 'imgs', {}, checkImageExists, addFileToJcr, '/files', 'test');
        expect(res).toEqual([
            {uuid: 'uuid2', status: 'created', name: 'a.png'},
            {uuid: 'uuid2', status: 'created', name: 'b.png'}
        ]);
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});
