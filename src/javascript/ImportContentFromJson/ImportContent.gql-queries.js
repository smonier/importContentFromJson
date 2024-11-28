import {gql} from '@apollo/client';

export const GetContentTypeQuery = gql`
    query SiteContentTypesQuery($siteKey: String!, $language:String!) {
        jcr {
            nodeTypes(filter: {includeMixins: false, siteKey: $siteKey, includeTypes: ["jmix:droppableContent", "jnt:page", "jnt:file"], excludeTypes: ["jmix:studioOnly", "jmix:hiddenType", "jnt:editableFile"]}) {
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
                    properties(fieldFilter: {filters: [{fieldName: "hidden", value: "false"}]}) {
                        name
                        hidden
                        displayName(language: $language)
                        internationalized
                    }
                }
            }
        }
    }
`;

export const FetchContentForCSVQuery = gql`
    query getContentsByContentType($path: String!, $language: String!, $type: String!, $workspace: Workspace!, $properties: [String]) {
        jcr(workspace: $workspace) {
            result: nodeByPath(path: $path) {
                value: uuid
                label: displayName(language: $language)
                descendants(typesFilter: {types: [$type]}) {
                    nodes {
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
                path
            }
        }
    }
`;
export const CreatePathMutation = gql`
    mutation CreatePathMutation($path: String!, $name: String!) {
        jcr (workspace: EDIT){
            addNode(
                name: $name
                parentPathOrId: $path
                primaryNodeType: "jnt:contentFolder"
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