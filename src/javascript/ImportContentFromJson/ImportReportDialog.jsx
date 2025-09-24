import React from 'react';
import PropTypes from 'prop-types';
import {Button} from '@jahia/moonstone';
import {Dialog, DialogTitle, DialogContent, DialogActions} from '@mui/material';

const ImportReportDialog = ({open, onClose, report, t}) => {
    if (!report) {
        return null;
    }

    const {
        nodes = [],
        images = [],
        categories = [],
        errors = [],
        path,
        summary = {},
        contentType
    } = report;

    const summaryGridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '16px'
    };
    const summaryBlockStyle = {
        border: '1px solid #dcdcdc',
        borderRadius: '8px',
        padding: '12px',
        background: '#fafafa'
    };
    const summaryTitleStyle = {fontWeight: 600, marginBottom: '4px', fontSize: '0.9rem'};
    const summaryValueStyle = {fontSize: '0.95rem', wordBreak: 'break-word'};
    const summaryMetaStyle = {fontSize: '0.8rem', color: '#555'};
    const summaryListStyle = {listStyle: 'none', padding: 0, margin: '8px 0 0 0', fontSize: '0.85rem'};
    const summaryListItemStyle = {display: 'flex', justifyContent: 'space-between', marginBottom: '4px'};

    const renderTable = (items, firstHeader) => (
        <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '0.85rem'}}>
            <thead>
                <tr>
                    <th style={{textAlign: 'left', borderBottom: '1px solid #ccc'}}>{firstHeader}</th>
                    <th style={{textAlign: 'left', borderBottom: '1px solid #ccc'}}>{t('label.nodePath')}</th>
                    <th style={{textAlign: 'left', borderBottom: '1px solid #ccc'}}>{t('label.status')}</th>
                </tr>
            </thead>
            <tbody>
                {items.map((item, index) => (
                    <tr key={index}>
                        <td style={{padding: '4px 8px'}}>{item.name}</td>
                        <td style={{padding: '4px 8px'}}>{item.node || ''}</td>
                        <td style={{padding: '4px 8px'}}>{item.status}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    const renderErrorTable = items => (
        <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '0.85rem'}}>
            <thead>
                <tr>
                    <th style={{textAlign: 'left', borderBottom: '1px solid #ccc'}}>{t('label.node')}</th>
                    <th style={{textAlign: 'left', borderBottom: '1px solid #ccc'}}>{t('label.reason')}</th>
                    <th style={{textAlign: 'left', borderBottom: '1px solid #ccc'}}>{t('label.details')}</th>
                </tr>
            </thead>
            <tbody>
                {items.map((item, index) => (
                    <tr key={index}>
                        <td style={{padding: '4px 8px'}}>{item.node}</td>
                        <td style={{padding: '4px 8px'}}>{item.reason}</td>
                        <td style={{padding: '4px 8px'}}>{item.details}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    const computeNodeFallback = () => {
        const validNodes = nodes.filter(item => item?.name && item.name !== 'import');
        return validNodes.reduce((acc, item) => {
            switch (item.status) {
            case 'created':
                acc.created++;
                break;
            case 'updated':
                acc.updated++;
                break;
            case 'already exists':
                acc.skipped++;
                break;
            case 'failed':
                acc.failed++;
                break;
            default:
                break;
            }

            acc.processed = (acc.processed || 0) + 1;
            acc.total = (acc.total || 0) + 1;
            return acc;
        }, {created: 0, updated: 0, failed: 0, skipped: 0, total: 0, processed: 0});
    };

    const computeImageFallback = () => images.reduce((acc, item) => {
        switch (item.status) {
        case 'created':
            acc.created++;
            break;
        case 'updated':
            acc.updated++;
            break;
        case 'already exists':
            acc.skipped++;
            break;
        case 'failed':
            acc.failed++;
            break;
        default:
            break;
        }

        acc.total++;
        acc.processed++;
        return acc;
    }, {created: 0, updated: 0, failed: 0, skipped: 0, total: 0, processed: 0});

    const computeCreatedCategoriesFallback = () => categories.reduce((acc, item) => {
        if (item.status === 'created') {
            const key = item.name || t('label.unknownCategory');
            acc[key] = (acc[key] || 0) + 1;
        }

        return acc;
    }, {});

    const nodeSummary = {...computeNodeFallback(), ...(summary.nodes || {})};
    const imageSummary = {...computeImageFallback(), ...(summary.images || {})};
    const createdCategories = summary.categories?.createdByName || computeCreatedCategoriesFallback();
    const categoryEntries = Object.entries(createdCategories).filter(([, count]) => count > 0);

    const contentTypeName = summary.contentType?.label || contentType?.label || contentType?.value || t('label.notAvailable');
    const importPath = summary.path || path || '';

    const handleDownload = () => {
        const blob = new Blob([JSON.stringify(report, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'import-report.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Dialog fullWidth open={open} maxWidth="md" onClose={onClose}>
            <DialogTitle>{t('label.reportTitle')}</DialogTitle>
            <DialogContent dividers>
                <div style={{marginBottom: '8px', fontWeight: 600}}>{t('label.reportSummaryTitle')}</div>
                <div style={summaryGridStyle}>
                    <div style={summaryBlockStyle}>
                        <div style={summaryTitleStyle}>{t('label.summaryContentType')}</div>
                        <div style={summaryValueStyle}>{contentTypeName || t('label.notAvailable')}</div>
                    </div>
                    <div style={summaryBlockStyle}>
                        <div style={summaryTitleStyle}>{t('label.summaryImportPath')}</div>
                        <div style={summaryValueStyle}>{importPath || t('label.notAvailable')}</div>
                    </div>
                    <div style={summaryBlockStyle}>
                        <div style={summaryTitleStyle}>{t('label.summaryNodesTitle')}</div>
                        <div style={summaryValueStyle}>{t('label.summaryTotalFound', {count: nodeSummary.total || 0})}</div>
                        {typeof nodeSummary.processed === 'number' && nodeSummary.total !== nodeSummary.processed && (
                            <div style={summaryMetaStyle}>{t('label.summaryProcessed', {count: nodeSummary.processed || 0})}</div>
                        )}
                        <ul style={summaryListStyle}>
                            <li style={summaryListItemStyle}>
                                <span>{t('label.summaryCreated')}</span>
                                <strong>{nodeSummary.created || 0}</strong>
                            </li>
                            <li style={summaryListItemStyle}>
                                <span>{t('label.summaryUpdated')}</span>
                                <strong>{nodeSummary.updated || 0}</strong>
                            </li>
                            <li style={summaryListItemStyle}>
                                <span>{t('label.summaryFailed')}</span>
                                <strong>{nodeSummary.failed || 0}</strong>
                            </li>
                            {nodeSummary.skipped ? (
                                <li style={summaryListItemStyle}>
                                    <span>{t('label.summarySkipped')}</span>
                                    <strong>{nodeSummary.skipped}</strong>
                                </li>
                            ) : null}
                        </ul>
                    </div>
                    <div style={summaryBlockStyle}>
                        <div style={summaryTitleStyle}>{t('label.summaryImagesTitle')}</div>
                        <div style={summaryValueStyle}>{t('label.summaryImagesTotal', {count: imageSummary.total || 0})}</div>
                        {typeof imageSummary.processed === 'number' && imageSummary.total !== imageSummary.processed && (
                            <div style={summaryMetaStyle}>{t('label.summaryProcessed', {count: imageSummary.processed || 0})}</div>
                        )}
                        <ul style={summaryListStyle}>
                            <li style={summaryListItemStyle}>
                                <span>{t('label.summaryCreated')}</span>
                                <strong>{imageSummary.created || 0}</strong>
                            </li>
                            <li style={summaryListItemStyle}>
                                <span>{t('label.summaryUpdated')}</span>
                                <strong>{imageSummary.updated || 0}</strong>
                            </li>
                            <li style={summaryListItemStyle}>
                                <span>{t('label.summaryFailed')}</span>
                                <strong>{imageSummary.failed || 0}</strong>
                            </li>
                            {imageSummary.skipped ? (
                                <li style={summaryListItemStyle}>
                                    <span>{t('label.summarySkipped')}</span>
                                    <strong>{imageSummary.skipped}</strong>
                                </li>
                            ) : null}
                        </ul>
                    </div>
                </div>
                {nodes.length > 0 && renderTable(nodes, t('label.node'))}
                {images.length > 0 && renderTable(images, t('label.image'))}
                {categories.length > 0 && renderTable(categories, t('label.category'))}
                {errors.length > 0 && renderErrorTable(errors)}
                {categoryEntries.length > 0 && (
                    <div style={{marginTop: '24px'}}>
                        <div style={{fontWeight: 600, marginBottom: '8px'}}>{t('label.categorySummaryTitle')}</div>
                        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem'}}>
                            <thead>
                                <tr>
                                    <th style={{textAlign: 'left', borderBottom: '1px solid #ccc', padding: '4px 8px'}}>{t('label.category')}</th>
                                    <th style={{textAlign: 'right', borderBottom: '1px solid #ccc', padding: '4px 8px'}}>{t('label.createdCount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categoryEntries.map(([categoryName, count]) => (
                                    <tr key={categoryName}>
                                        <td style={{padding: '4px 8px'}}>{categoryName}</td>
                                        <td style={{padding: '4px 8px', textAlign: 'right'}}>{count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </DialogContent>
            <DialogActions>
                <Button label={t('label.downloadReport')} onClick={handleDownload}/>
                <Button label={t('label.closeReport')} onClick={onClose}/>
            </DialogActions>
        </Dialog>
    );
};

ImportReportDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    report: PropTypes.object,
    t: PropTypes.func.isRequired
};

export default ImportReportDialog;
