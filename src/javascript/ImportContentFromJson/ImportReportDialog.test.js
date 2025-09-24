import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ImportReportDialog from './ImportReportDialog.jsx';
import en from '../../main/resources/javascript/locales/en.json';

describe('ImportReportDialog', () => {
    const t = (key, params) => {
        const stripped = key.replace('label.', '');
        let template = en.label[stripped] || key;

        if (params) {
            Object.keys(params).forEach(paramKey => {
                const value = params[paramKey];
                template = template.replace(new RegExp(`{{${paramKey}}}`, 'g'), value);
            });
        }

        return template;
    };

    test('renders enhanced summary information', () => {
        const report = {
            path: '/content',
            nodes: [
                {name: '/content/article-one', status: 'created'},
                {name: '/content/article-two', status: 'updated'},
                {name: '/content/article-three', status: 'failed'}
            ],
            images: [
                {name: 'hero.png', status: 'created', node: '/content/article-one'},
                {name: 'thumbnail.png', status: 'failed', node: '/content/article-three'}
            ],
            categories: [
                {name: 'News', status: 'created', node: '/content/article-one'},
                {name: 'News', status: 'created', node: '/content/article-two'},
                {name: 'Sports', status: 'failed', node: '/content/article-three'}
            ],
            summary: {
                contentType: {label: 'Article', value: 'jnt:article'},
                path: '/content',
                nodes: {created: 1, updated: 1, failed: 1, skipped: 0, total: 3, processed: 3},
                images: {created: 1, updated: 0, failed: 1, skipped: 0, total: 2, processed: 2},
                categories: {createdByName: {News: 2}, created: 2, failed: 1, skipped: 0, processed: 3}
            }
        };

        const html = ReactDOMServer.renderToStaticMarkup(
            <ImportReportDialog open={true} onClose={() => {}} report={report} t={t}/>
        );

        expect(html).toContain(en.label.reportSummaryTitle);
        expect(html).toContain('Article');
        expect(html).toContain(t('label.summaryTotalFound', {count: 3}));
        expect(html).toContain(t('label.summaryImagesTotal', {count: 2}));
        expect(html).toContain(en.label.summaryCreated);
        expect(html).toContain(en.label.summaryUpdated);
        expect(html).toContain(en.label.summaryFailed);
        expect(html).toContain(en.label.categorySummaryTitle);
        expect(html).toContain('News');
        expect(html).toContain(en.label.nodePath);
        expect(html).toContain('/content/article-one');
    });
});
