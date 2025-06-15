import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ImportReportDialog from './ImportReportDialog.jsx';
import en from '../../main/resources/javascript/locales/en.json';

describe('ImportReportDialog', () => {
    const t = key => {
        const stripped = key.replace('label.', '');
        return en.label[stripped] || key;
    };

    test('renders node path column', () => {
        const report = {
            path: '/content',
            images: [{name: 'img.png', status: 'created', node: '/content/imgNode'}]
        };
        const html = ReactDOMServer.renderToStaticMarkup(
            <ImportReportDialog open={true} onClose={() => {}} report={report} t={t}/>
        );

        expect(html).toContain(en.label.nodePath);
        expect(html).toContain('/content/imgNode');
        expect(html).toContain('/content');
    });
});
