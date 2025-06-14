import React from 'react';
import PropTypes from 'prop-types';
import {Dialog, Typography, Table, TableBody, TableCell, TableHead, TableRow, Button} from '@jahia/moonstone';
import {useTranslation} from 'react-i18next';

const ImportReportDialog = ({open, onClose, report}) => {
    const {t} = useTranslation('importContentFromJson');
    const nodes = report?.nodes || [];

    return (
        <Dialog open={open} maxWidth="lg" fullWidth>
            <DialogHeader title={t('label.reportTitle')} onClose={onClose}/>
            <DialogContent>
                {nodes.map((node, index) => (
                    <div key={index} style={{marginBottom: '1rem'}}>
                        <Typography variant="subtitle" style={{marginBottom: '0.5rem'}}>
                            {node.path}
                        </Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('label.column.type')}</TableCell>
                                    <TableCell>{t('label.column.name')}</TableCell>
                                    <TableCell>{t('label.column.status')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                <TableRow>
                                    <TableCell>Node</TableCell>
                                    <TableCell>{node.path}</TableCell>
                                    <TableCell>{t(`label.status.${node.status}`)}</TableCell>
                                </TableRow>
                                {node.images && node.images.map((img, imgIndex) => (
                                    <TableRow key={imgIndex}>
                                        <TableCell>{t('label.column.image')}</TableCell>
                                        <TableCell>{img.name}</TableCell>
                                        <TableCell>{t(`label.status.${img.status}`)}</TableCell>
                                    </TableRow>
                                ))}
                                {node.categories && node.categories.map((cat, catIndex) => (
                                    <TableRow key={catIndex}>
                                        <TableCell>{t('label.column.category')}</TableCell>
                                        <TableCell>{cat.name}</TableCell>
                                        <TableCell>{t(`label.status.${cat.status}`)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ))}
            </DialogContent>
            <DialogActions>
                <Button color="accent" label={t('label.closeReport')} onClick={onClose}/>
            </DialogActions>
        </Dialog>
    );
};

const DialogHeader = ({title, onClose}) => (
    <div className="flexRow_between" style={{padding: '16px'}}>
        <Typography variant="heading">{title}</Typography>
        <Button data-sel-role="close" icon="Close" variant="ghost" onClick={onClose}/>
    </div>
);

const DialogContent = ({children}) => (
    <div style={{padding: '0 16px 16px'}}>{children}</div>
);

const DialogActions = ({children}) => (
    <div className="flexRow_end" style={{padding: '0 16px 16px'}}>{children}</div>
);

ImportReportDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    report: PropTypes.shape({
        nodes: PropTypes.arrayOf(PropTypes.shape({
            path: PropTypes.string,
            status: PropTypes.string,
            images: PropTypes.arrayOf(PropTypes.shape({name: PropTypes.string, status: PropTypes.string})),
            categories: PropTypes.arrayOf(PropTypes.shape({name: PropTypes.string, status: PropTypes.string}))
        }))
    })
};

export default ImportReportDialog;
