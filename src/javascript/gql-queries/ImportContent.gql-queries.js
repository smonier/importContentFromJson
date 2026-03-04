import {gql} from '@apollo/client';

export const GetContentTypeQuery = gql`
    query SiteContentTypesQuery($siteKey: String!, $language:String!) {
        jcr {
            nodeTypes(filter: {includeMixins: false, siteKey: $siteKey, includeTypes: ["jmix:mainResource", "jnt:page", "jnt:file","jmix:editorialContent"], excludeTypes: ["jmix:studioOnly", "jmix:hiddenType", "jnt:editableFile"]}) {
                nodes {
                    name
                    displayName(language: $language)
                    icon
                }
            }
        }
    }
`;

export const PROPERTY_DEFINITION_FIELDS = gql`
    fragment PropertyDefinitionFields on JCRPropertyDefinition {
        displayName(language: $language)
        name
        internationalized
        multiple
        mandatory
        requiredType
        constraints
    }
`;

export const NODE_TYPE_BASE_FIELDS = gql`
    fragment NodeTypeBaseFields on JCRNodeType {
        name
        displayName(language: $language)
    }
`;

export const NODE_TYPE_SUPERTYPE_FIELDS = gql`
    fragment NodeTypeSupertypeFields on JCRNodeType {
        ...NodeTypeBaseFields
        mixin
    }
`;

export const GetContentPropertiesQuery = gql`
    ${PROPERTY_DEFINITION_FIELDS}
    ${NODE_TYPE_BASE_FIELDS}

    query GetContentPropertiesQuery(
        $type: String!
        $language: String!
    ) {
        jcr {
            nodeTypes(filter: { includeTypes: [$type] }) {
                nodes {
                    ...NodeTypeBaseFields

                    properties(
                        fieldFilter: {
                            filters: [
                                { fieldName: "hidden", value: "false" }
                                { fieldName: "protected", value: "false" }
                            ]
                        }
                    ) {
                        ...PropertyDefinitionFields
                    }

                    extendedBy {
                        nodes {
                            ...NodeTypeBaseFields
                            properties(
                                fieldFilter: {
                                    filters: [
                                        { fieldName: "hidden", value: "false" }
                                        { fieldName: "protected", value: "false" }
                                    ]
                                }
                            ) {
                                ...PropertyDefinitionFields
                            }
                        }
                    }
                }
            }
        }
    }
`;
export const FetchContentForCSVQuery = gql`
    query getContentsByContentType(
        $path: String!, 
        $language: String!, 
        $type: String!, 
        $workspace: Workspace!, 
        $properties: [String]
    ) {
        jcr(workspace: $workspace) {
            result: nodeByPath(path: $path) {
                name
                value: uuid
                label: displayName(language: $language)
                workspace
                descendants(typesFilter: {types: [$type]}) {
                    nodes {
                        name
                        value: uuid
                        label: displayName(language: $language)
                        properties(names: $properties, language: $language) {
                            name
                            value
                        }
                    }
                }
            }
        }
    }
`;

export const CheckPathQuery = gql`
    query CheckPathQuery($path: String!) {
        jcr {
            nodeByPath(path: $path) {
                uuid
                path
                workspace
            }
        }
    }
`;
export const CreatePathMutation = gql`
    mutation CreatePathMutation($path: String!, $name: String!, $nodeType: String!) {
        jcr (workspace: EDIT){
            addNode(
                name: $name
                parentPathOrId: $path
                primaryNodeType: $nodeType
            ){
                uuid
                node {
                    name
                }
            }
        }
    }
`;

export const CreateContentMutation = gql`
    mutation CreateContentMutation(
        $path: String!
        $name: String!
        $primaryNodeType: String!
        $mixins: [String]!
        $properties: [InputJCRProperty]!
    ) {
        jcr(workspace: EDIT) {
            addNode(
                name: $name
                parentPathOrId: $path
                primaryNodeType: $primaryNodeType
                mixins: $mixins
                properties: $properties
            ) {
                uuid
                node {
                    name
                    path
                }
            }
        }
    }`;

export const UpdateContentMutation = gql`
    mutation UpdateContentMutation($pathOrId: String!, $mixins: [String] = [], $properties: [InputJCRProperty] = []) {
        jcr(workspace: EDIT) {
            mutateNode(pathOrId: $pathOrId) {
                addMixins(mixins: $mixins)
                setPropertiesBatch(properties: $properties) {
                    path
                }
                uuid
            }
        }
    }`;

export const CreateFileMutation = gql`
    mutation uploadFile(
        $nameInJCR: String!, 
        $path: String!, 
        $mimeType: String!, 
        $fileHandle: String!
    ) {
        jcr {
            addNode(name: $nameInJCR, parentPathOrId: $path, primaryNodeType: "jnt:file") {
                addChild(name: "jcr:content", primaryNodeType: "jnt:resource") {
                    content: mutateProperty(name: "jcr:data") {
                        setValue(type: BINARY, value: $fileHandle)
                    }
                    contentType: mutateProperty(name: "jcr:mimeType") {
                        setValue(value: $mimeType)
                    }
                }
                uuid
            }
        }
    }`;

export const CheckImageExists = gql`
    query CheckImageExists($path: String!) {
        jcr {
            nodeByPath(path: $path) {
                uuid
                name
                path
                workspace
                children {
                    nodes {
                        name
                        uuid
                        workspace
                    }
                }
            }
        }
    }`;

export const AddTags = gql`
    mutation addTags($path:String!, $tags:[String]!) {
        jcr {
            mutateNode(pathOrId: $path) {
                addMixins(mixins:["jmix:tagged"])
                mutateProperty(name:"j:tagList") {
                    setValues(values:$tags)
                }
                uuid
            }
        }
    }`;

export const AddCategories = gql`
    mutation addCategories($path:String!, $categories:[String]!) {
        jcr {
            mutateNode(pathOrId: $path) {
                addMixins(mixins:["jmix:categorized"])
                mutateProperty(name:"j:defaultCategory") {
                    setValues(values:$categories)
                }
                uuid
            }
        }
    }`;

export const CATEGORIES_FIELDS = gql`
    fragment CategoryCheck on JCRNode {
        children {
            nodes {
                name
                uuid
                workspace
                children {
                    nodes {
                        name
                        uuid
                        workspace
                    }
                }
            }
        }
    }
`;

export const CheckIfCategoryExists = gql`
    query CheckIfCategoryExists {
        jcr {
            nodeByPath(path: "/sites/systemsite/categories") {
                uuid
                name
                path
                workspace
                children {
                    nodes {
                        name
                        uuid
                        workspace
                        ...CategoryCheck
                    }
                }
            }
        }
    }
${CATEGORIES_FIELDS}`;

export const AddVanityUrl = gql`
    mutation addVanityUrl($pathOrId: String!, $language: String!, $url: String!){
        jcr{
            mutateNode(pathOrId: $pathOrId){
                addVanityUrl(vanityUrlInputList: [{
                    language: $language,
                    active: true,
                    defaultMapping: true,
                    url: $url
                }]){
                    uuid
                }
            }
        }
    }`;

export const GET_SITE_LANGUAGES = gql`
    query GetSiteLanguages($workspace: Workspace!, $scope: String!) {
        jcr(workspace: $workspace) {
            nodeByPath(path: $scope) {
                displayName
                isDisplayableNode
                languages: property(name: "j:languages") {
                    values
                }
            }
        }
    }
`;
