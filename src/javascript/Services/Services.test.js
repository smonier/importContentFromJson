import {ApolloError} from '@apollo/client';
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
        expect(addFileToJcr.mock.calls[0][0].variables.fileHandle.name).toBe('img.png');
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
        expect(addFileToJcr.mock.calls[0][0].variables.fileHandle.name).toBe('a.png');
        expect(addFileToJcr.mock.calls[1][0].variables.fileHandle.name).toBe('b.png');
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
        expect(addFileToJcr.mock.calls[0][0].variables.fileHandle.name).toBe('a.png');
        expect(addFileToJcr.mock.calls[1][0].variables.fileHandle.name).toBe('b.png');
    });

    test('handleSingleImage uploads when checkImageExists throws PathNotFoundException', async () => {
        const checkImageExists = jest.fn(() => Promise.reject(new ApolloError({errorMessage: 'PathNotFoundException'})));
        const addFileToJcr = jest.fn(() => Promise.resolve({data: {jcr: {addNode: {uuid: 'uuidPath'}}}}));

        const res = await handleSingleImage('http://example.com/img.png', 'img', checkImageExists, addFileToJcr, '/files', 'test');
        expect(res.uuid).toBe('uuidPath');
        expect(res.status).toBe('created');
        expect(fetch).toHaveBeenCalled();
    });

    test('handleSingleImage fails when checkImageExists throws other error', async () => {
        const checkImageExists = jest.fn(() => Promise.reject(new Error('boom')));
        const addFileToJcr = jest.fn();

        const res = await handleSingleImage('http://example.com/img.png', 'img', checkImageExists, addFileToJcr, '/files', 'test');
        expect(res.uuid).toBeNull();
        expect(res.status).toBe('failed');
        expect(fetch).not.toHaveBeenCalled();
        expect(addFileToJcr).not.toHaveBeenCalled();
    });

    test('handleMultipleImages uploads when checkImageExists throws PathNotFoundException', async () => {
        const checkImageExists = jest.fn(() => Promise.reject(new ApolloError({errorMessage: 'PathNotFoundException'})));
        const addFileToJcr = jest.fn(() => Promise.resolve({data: {jcr: {addNode: {uuid: 'uuid3'}}}}));

        const res = await handleMultipleImages(['http://ex.com/a.png'], 'imgs', {}, checkImageExists, addFileToJcr, '/files', 'test');
        expect(res).toEqual([
            {uuid: 'uuid3', status: 'created', name: 'a.png'}
        ]);
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});
