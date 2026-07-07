import React from 'react';
import PropTypes from 'prop-types';
import {
    Button,
    Chip,
    Paper,
    Typography,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableHeadCell,
    TableBodyCell,
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter
} from '@jahia/moonstone';
import styles from './ImportReportDialog.scss';

/**
 * Map an import status to a semantic Moonstone Chip colour.
 */
const STATUS_COLOR = {
    created: 'success',
    updated: 'accent',
    'already exists': 'default',
    skipped: 'warning',
    failed: 'danger'
};

const StatusChip = ({status}) => (
    <Chip label={status || '—'} color={STATUS_COLOR[status] || 'default'}/>
);

StatusChip.propTypes = {status: PropTypes.string};

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

    const tallyStatus = (acc, status) => {
        if (status === 'created') {
            acc.created++;
        } else if (status === 'updated') {
            acc.updated++;
        } else if (status === 'already exists') {
            acc.skipped++;
        } else if (status === 'failed') {
            acc.failed++;
        }

        acc.total++;
        acc.processed++;
        return acc;
    };

    const computeNodeFallback = () => nodes
        .filter(item => item?.name && item.name !== 'import')
        .reduce((acc, item) => tallyStatus(acc, item.status), {created: 0, updated: 0, failed: 0, skipped: 0, total: 0, processed: 0});

    const computeImageFallback = () => images
        .reduce((acc, item) => tallyStatus(acc, item.status), {created: 0, updated: 0, failed: 0, skipped: 0, total: 0, processed: 0});

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
    const vanitySummary = {
        enabled: summary.vanityUrls?.enabled ?? false,
        created: summary.vanityUrls?.created ?? 0,
        failed: summary.vanityUrls?.failed ?? 0,
        skipped: summary.vanityUrls?.skipped ?? 0
    };
    const vanityStatusLabel = vanitySummary.enabled ?
        t('label.summaryVanityUrlsStatusEnabled') :
        t('label.summaryVanityUrlsStatusDisabled');

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

    const StatRow = ({labelKey, value}) => (
        <li className={styles.statRow}>
            <Typography variant="caption">{t(labelKey)}</Typography>
            <Typography variant="caption" weight="bold">{value || 0}</Typography>
        </li>
    );

    const renderStatusTable = (items, firstHeader) => (
        <Table>
            <TableHead>
                <TableRow>
                    <TableHeadCell>{firstHeader}</TableHeadCell>
                    <TableHeadCell>{t('label.nodePath')}</TableHeadCell>
                    <TableHeadCell>{t('label.status')}</TableHeadCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {items.map((item, index) => (
                    <TableRow key={index}>
                        <TableBodyCell>{item.name}</TableBodyCell>
                        <TableBodyCell>{item.node || ''}</TableBodyCell>
                        <TableBodyCell><StatusChip status={item.status}/></TableBodyCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );

    const renderErrorTable = items => (
        <Table>
            <TableHead>
                <TableRow>
                    <TableHeadCell>{t('label.node')}</TableHeadCell>
                    <TableHeadCell>{t('label.reason')}</TableHeadCell>
                    <TableHeadCell>{t('label.details')}</TableHeadCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {items.map((item, index) => (
                    <TableRow key={index}>
                        <TableBodyCell>{item.node}</TableBodyCell>
                        <TableBodyCell>{item.reason}</TableBodyCell>
                        <TableBodyCell>{item.details}</TableBodyCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );

    return (
        <Modal isOpen={open} size="large" onOpenChange={isOpen => !isOpen && onClose()}>
            <>
                <ModalHeader title={t('label.reportTitle')}/>
                <ModalBody>
                    {/* Summary */}
            <div className={styles.section}>
                <Typography variant="subheading" weight="bold" className={styles.sectionTitle}>
                    {t('label.reportSummaryTitle')}
                </Typography>
                <div className={styles.summaryGrid}>
                    <Paper className={styles.card}>
                        <Typography variant="caption" weight="bold" className={styles.cardTitle}>{t('label.summaryContentType')}</Typography>
                        <Typography variant="body" className={styles.cardValue}>{contentTypeName}</Typography>
                    </Paper>
                    <Paper className={styles.card}>
                        <Typography variant="caption" weight="bold" className={styles.cardTitle}>{t('label.summaryImportPath')}</Typography>
                        <Typography variant="body" className={styles.cardValue}>{importPath || t('label.notAvailable')}</Typography>
                    </Paper>
                    <Paper className={styles.card}>
                        <Typography variant="caption" weight="bold" className={styles.cardTitle}>{t('label.summaryNodesTitle')}</Typography>
                        <Typography variant="body" className={styles.cardValue}>{t('label.summaryTotalFound', {count: nodeSummary.total || 0})}</Typography>
                        <ul className={styles.statList}>
                            <StatRow labelKey="label.summaryCreated" value={nodeSummary.created}/>
                            <StatRow labelKey="label.summaryUpdated" value={nodeSummary.updated}/>
                            <StatRow labelKey="label.summaryFailed" value={nodeSummary.failed}/>
                            {nodeSummary.skipped ? <StatRow labelKey="label.summarySkipped" value={nodeSummary.skipped}/> : null}
                        </ul>
                    </Paper>
                    <Paper className={styles.card}>
                        <Typography variant="caption" weight="bold" className={styles.cardTitle}>{t('label.summaryImagesTitle')}</Typography>
                        <Typography variant="body" className={styles.cardValue}>{t('label.summaryImagesTotal', {count: imageSummary.total || 0})}</Typography>
                        <ul className={styles.statList}>
                            <StatRow labelKey="label.summaryCreated" value={imageSummary.created}/>
                            <StatRow labelKey="label.summaryUpdated" value={imageSummary.updated}/>
                            <StatRow labelKey="label.summaryFailed" value={imageSummary.failed}/>
                            {imageSummary.skipped ? <StatRow labelKey="label.summarySkipped" value={imageSummary.skipped}/> : null}
                        </ul>
                    </Paper>
                    <Paper className={styles.card}>
                        <Typography variant="caption" weight="bold" className={styles.cardTitle}>{t('label.summaryVanityUrlsTitle')}</Typography>
                        <Typography variant="body" className={styles.cardValue}>{vanityStatusLabel}</Typography>
                        <ul className={styles.statList}>
                            <StatRow labelKey="label.summaryCreated" value={vanitySummary.created}/>
                            <StatRow labelKey="label.summaryFailed" value={vanitySummary.failed}/>
                            <StatRow labelKey="label.summarySkipped" value={vanitySummary.skipped}/>
                        </ul>
                    </Paper>
                </div>
            </div>

            {/* Nodes */}
            {nodes.length > 0 && (
                <div className={styles.section}>
                    <Typography variant="subheading" weight="bold" className={styles.sectionTitle}>{t('label.reportNodesTitle')}</Typography>
                    {renderStatusTable(nodes, t('label.node'))}
                </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
                <div className={styles.section}>
                    <Typography variant="subheading" weight="bold" className={styles.sectionTitle}>{t('label.reportErrorsTitle')}</Typography>
                    {renderErrorTable(errors)}
                </div>
            )}

            {/* Images */}
            {images.length > 0 && (
                <div className={styles.section}>
                    <Typography variant="subheading" weight="bold" className={styles.sectionTitle}>{t('label.reportImagesTitle')}</Typography>
                    {renderStatusTable(images, t('label.image'))}
                </div>
            )}

            {/* Categories */}
            {(categoryEntries.length > 0 || categories.length > 0) && (
                <div className={styles.section}>
                    <Typography variant="subheading" weight="bold" className={styles.sectionTitle}>{t('label.reportCategoriesTitle')}</Typography>
                    {categoryEntries.length > 0 && (
                        <>
                            <Typography variant="body" weight="bold" className={styles.subSectionTitle}>{t('label.categorySummaryTitle')}</Typography>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableHeadCell>{t('label.category')}</TableHeadCell>
                                        <TableHeadCell textAlign="right">{t('label.createdCount')}</TableHeadCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {categoryEntries.map(([categoryName, count]) => (
                                        <TableRow key={categoryName}>
                                            <TableBodyCell>{categoryName}</TableBodyCell>
                                            <TableBodyCell textAlign="right">{count}</TableBodyCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </>
                    )}
                    {categories.length > 0 && (
                        <>
                            <Typography variant="body" weight="bold" className={styles.subSectionTitle}>{t('label.reportCategoriesDetailsTitle')}</Typography>
                            {renderStatusTable(categories, t('label.category'))}
                        </>
                    )}
                </div>
            )}
                </ModalBody>
                <ModalFooter>
                    <Button label={t('label.downloadReport')} onClick={handleDownload}/>
                    <Button color="accent" label={t('label.closeReport')} onClick={onClose}/>
                </ModalFooter>
            </>
        </Modal>
    );
};

ImportReportDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    report: PropTypes.object,
    t: PropTypes.func.isRequired
};

export default ImportReportDialog;
