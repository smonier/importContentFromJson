import {gql} from '@apollo/client';

export const SIMPLE_CORE_NODE_FIELDS = gql`
    fragment SimpleCoreNodeFields on JCRNode {
        workspace
        uuid
        path
        name
    }`;

export const CORE_NODE_FIELDS = gql`
    ${SIMPLE_CORE_NODE_FIELDS}
    fragment CoreNodeFields on JCRNode {
       ...SimpleCoreNodeFields
        primaryNodeType {
            name
            supertypes{name}
        }
        mixinTypes {name}
    }`;
