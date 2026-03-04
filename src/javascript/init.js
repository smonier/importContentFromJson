import {registry} from '@jahia/ui-extender';
import ImportContentAction from './ImportContentFromJson';

const registerImportContentAction = () => {
    window.jahia.i18n.loadNamespaces('importContentFromJson');

    const accordionType = 'accordionItem';
    const accordionKey = 'contentToolsAccordion';
    const accordionExists = window.jahia.uiExtender.registry.get(accordionType, accordionKey);

    if (!accordionExists) {
        registry.add(accordionType, accordionKey, registry.get(accordionType, 'renderDefaultApps'), {
            targets: ['jcontent:75'],
            icon: window.jahia.moonstone.toIconComponent('<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 7h18v4H3V7zm2 6h14v8H5v-8zm3-8h8v2H8V5z"/></svg>'),
            label: 'importContentFromJson:accordion.title',
            appsTarget: 'contentToolsAccordionApps'
        });
    }

    registry.add('adminRoute', 'ImportContentAction', {
        targets: ['contentToolsAccordionApps'],
        icon: window.jahia.moonstone.toIconComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h9"/><path d="M10 8l4 4-4 4"/><circle cx="18" cy="7" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="18" cy="17" r="2"/></svg>'),
        label: 'importContentFromJson:label.buttonAction',
        isSelectable: true,
        requireModuleInstalledOnSite: 'importContentFromJson',
        render: ImportContentAction
    });

    console.log('%c Import Content From JSON Component registered', 'color: #3c8cba');
};

export default function () {
    registry.add('callback', 'importContentFromJson', {
        targets: ['jahiaApp-init:99'],
        callback: registerImportContentAction
    });
}
