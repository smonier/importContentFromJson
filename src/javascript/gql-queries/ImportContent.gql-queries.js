import {gql} from '@apollo/client';

export const GetContentTypeQuery = gql`
    query SiteContentTypesQuery($siteKey: String!, $language:String!) {
        jcr {
            nodeTypes(filter: {includeMixins: false, siteKey: $siteKey, includeTypes: ["jnt:content","jmix:droppableContent", "jnt:page", "jnt:file"], excludeTypes: ["jmix:studioOnly", "jmix:hiddenType", "jnt:editableFile"]}) {
                nodes {
                    name
                    displayName(language: $language)
                    icon
                }
            }
        }
    }
`;

export const GetContentPropertiesQuery = gql`
    query GetContentPropertiesQuery($type: String!, $language: String!) {
        jcr {
            nodeTypes(filter: {includeTypes: [$type]}) {
                nodes {
                    name
                    properties(fieldFilter: {filters: [{fieldName: "hidden", value: "false"}]}) {
                        name
                        hidden
                        displayName(language: $language)
                        internationalized
                        mandatory
                        requiredType
                        constraints
                        multiple
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
        $properties: [InputJCRProperty]!
    ) {
        jcr(workspace: EDIT) {
            addNode(
                name: $name
                parentPathOrId: $path
                primaryNodeType: $primaryNodeType
                mixins: ["jmix:editorialContent"]
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
    mutation UpdateContentMutation($pathOrId: String!, $properties: [InputJCRProperty] = []) {
        jcr(workspace: EDIT) {
            mutateNode(pathOrId: $pathOrId) {
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
                createVersion
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
