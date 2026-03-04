/**
 * Performance utilities for ImportContent
 * Handles batch processing, rate limiting, and concurrent operations
 */

import {BATCH_SIZE, API_CALL_DELAY, MAX_CONCURRENT_REQUESTS} from './ImportContent.constants';
import logger from './ImportContent.logger';

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Process items in batches to avoid overwhelming the browser/server
 * @param {Array} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {number} batchSize - Number of items per batch
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise<Array>} Results from all processed items
 */
export const processBatch = async (items, processor, batchSize = BATCH_SIZE, onProgress = null) => {
    const results = [];
    const totalBatches = Math.ceil(items.length / batchSize);

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const currentBatch = Math.floor(i / batchSize) + 1;

        logger.debug(`Processing batch ${currentBatch}/${totalBatches}`, {
            items: batch.length,
            total: items.length
        });

        // Process batch items sequentially to avoid overwhelming the server
        for (const item of batch) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const result = await processor(item);
                results.push(result);

                // Small delay between items to prevent rate limiting
                if (API_CALL_DELAY > 0) {
                    // eslint-disable-next-line no-await-in-loop
                    await sleep(API_CALL_DELAY);
                }
            } catch (error) {
                logger.error('Batch processing error', {error: error.message});
                results.push({error: error.message, item});
            }
        }

        // Call progress callback if provided
        if (onProgress && typeof onProgress === 'function') {
            onProgress({
                batch: currentBatch,
                totalBatches,
                processedItems: Math.min((i + batchSize), items.length),
                totalItems: items.length
            });
        }

        // Yield to browser between batches
        // eslint-disable-next-line no-await-in-loop
        await sleep(0);
    }

    return results;
};

/**
 * Process items concurrently with a maximum concurrency limit
 * @param {Array} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {number} maxConcurrent - Maximum concurrent operations
 * @returns {Promise<Array>} Results from all processed items
 */
export const processConcurrent = async (items, processor, maxConcurrent = MAX_CONCURRENT_REQUESTS) => {
    const results = [];
    const executing = [];

    for (const [index, item] of items.entries()) {
        const promise = processor(item, index).then(result => {
            results[index] = result;
            return result;
        }).catch(error => {
            logger.error('Concurrent processing error', {error: error.message, index});
            results[index] = {error: error.message, item};
            return {error: error.message, item};
        });

        executing.push(promise);

        if (executing.length >= maxConcurrent) {
            // eslint-disable-next-line no-await-in-loop
            await Promise.race(executing);
            executing.splice(executing.findIndex(p => p === promise), 1);
        }
    }

    await Promise.all(executing);
    return results;
};

/**
 * Debounce function to limit how often a function can fire
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait = 300) => {
    let timeout;

    return function (...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Throttle function to limit execution rate
 * @param {Function} func - Function to throttle
 * @param {number} limit - Milliseconds between executions
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit = 1000) => {
    let inThrottle;

    return function (...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} initialDelay - Initial delay in ms
 * @returns {Promise<any>} Result from function
 */
export const retryWithBackoff = async (fn, maxRetries = 3, initialDelay = 1000) => {
    let lastError;

    for (let i = 0; i <= maxRetries; i++) {
        try {
            // eslint-disable-next-line no-await-in-loop
            return await fn();
        } catch (error) {
            lastError = error;

            if (i < maxRetries) {
                const delay = initialDelay * Math.pow(2, i);
                logger.warn(`Retry attempt ${i + 1}/${maxRetries} after ${delay}ms`, {
                    error: error.message
                });
                // eslint-disable-next-line no-await-in-loop
                await sleep(delay);
            }
        }
    }

    throw lastError;
};

/**
 * Measure execution time of a function
 * @param {Function} fn - Function to measure
 * @param {string} label - Label for logging
 * @returns {Promise<any>} Result from function
 */
export const measureTime = async (fn, label = 'Operation') => {
    const start = performance.now();

    try {
        const result = await fn();
        const duration = performance.now() - start;
        logger.debug(`${label} completed in ${duration.toFixed(2)}ms`);
        return result;
    } catch (error) {
        const duration = performance.now() - start;
        logger.error(`${label} failed after ${duration.toFixed(2)}ms`, {error: error.message});
        throw error;
    }
};

/**
 * Check if browser has enough memory for operation
 * @param {number} estimatedMemoryMB - Estimated memory needed in MB
 * @returns {boolean} True if enough memory available
 */
export const checkMemoryAvailability = estimatedMemoryMB => {
    if (!performance.memory) {
        // Memory API not available, assume it's okay
        return true;
    }

    const availableMemory = (performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize) / (1024 * 1024);
    const hasEnough = availableMemory > estimatedMemoryMB * 2; // 2x buffer

    if (!hasEnough) {
        logger.warn('Low memory warning', {
            available: `${availableMemory.toFixed(2)}MB`,
            required: `${estimatedMemoryMB}MB`
        });
    }

    return hasEnough;
};
