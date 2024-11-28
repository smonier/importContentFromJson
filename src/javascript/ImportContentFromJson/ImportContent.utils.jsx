import React from 'react';
import {ImgWrapper} from '@jahia/moonstone';

export const extractAndFormatContentTypeData = data => {
    const contentTypeSelectData = data.jcr.nodeTypes.nodes.map(item => {
        return {
            label: item.displayName,
            value: item.name,

            iconStart: <ImgWrapper src={item.icon + '.png'}/>
        };
    });

    contentTypeSelectData.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));

    return contentTypeSelectData;
};

export const findSelectedContentType = (contentTypeData, searchContentType) => {
    return contentTypeData.find(item => {
        if (item.value === searchContentType) {
            return item;
        }

        return null;
    });
};

/**
 * This function get the full name of a language by his id
 *
 * @param languages list of available languages
 * @param id language id to get
 * @returns the display name of a language
 */
export function getFullLanguageName(languages, id) {
    return languages.find(language =>
        language.language === id
    ).displayName;
}

/**
 * This function get the internationalized fields and their associated values from a form
 * @param formAndData form and values of a node
 * @returns The internationalized field and their values
 */
export function getI18nFieldAndValues(formAndData) {
    const {forms, jcr} = formAndData.data;
    let i18nFields = forms.editForm.sections
        .flatMap(section => section.fieldSets)
        .flatMap(fieldSet => fieldSet.fields)
        .filter(field => field.i18n)
        .map(field => {
            return {
                name: field.name,
                multiple: field.multiple
            };
        });

    return jcr.result.properties
        .filter(property => i18nFields.map(field => field.name).indexOf(property.name) > -1)
        .map(property => {
            return {
                ...property,
                multiple: i18nFields.find(field => field.name === property.name).multiple
            };
        });
}

export const exportCSVFile = (data, filename, headers, csvSeparator) => {
    // Construct the CSV header row
    const csvHeaderRow = headers.join(csvSeparator);

    // Map the data to CSV rows
    const csvRows = data.map(row =>
        headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(csvSeparator));

    // Combine headers and rows
    const csvContent = [csvHeaderRow, ...csvRows].join('\n');

    // Trigger the CSV download
    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};
