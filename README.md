# ImportContentFromJson Module

The **ImportContentFromJson** module facilitates importing content into Jahia JCR (Java Content Repository) structure from a JSON file. It simplifies content creation by mapping JSON fields to JCR properties based on the selected content type.

***This is a Jahia V8+ module***

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [GraphQL Queries and Mutations](#graphql-queries-and-mutations)
- [Error Handling](#error-handling)
- [Customization](#customization)
- [License](#license)

---

## Features

- Import JSON files to a specified JCR content path.
- Support for both internationalized (i18n) and non-internationalized properties.
- Validation of JSON fields against the selected content type properties.
- Automatic folder creation if the specified path doesn’t exist.
- Skipping of existing nodes with detailed reporting of skipped items.
- Fetch images from URL and upload them in to the JCR (using a proxy to avoid CORS issues)
- handle multiple for images
- check if image exists in JCR in folder importedFiles, before importing it
- A user-friendly interface with error messages and sample JSON previews.

---

## Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/smonier/ImportContentFromJson.git
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Start the development server:

    ```bash
    npm start
    ```

---

## Usage

1. Access the module’s UI within the CMS interface (jContent -> Additional).
2. Follow these steps to import content:
    - **Select the base content path.**
    - **Choose a content type.**
    - **Upload a valid JSON file.**
    - **Click “Import From JSON”** to initiate the process.
   3. Ensure the JSON file follows the structure below and matches the name of the properties of the selected Content Type:

```json
       [
         {
            "jcr:title": "L'intelligence artificielle au service de l'achat public",
            "teaser": "Découvrez comment l'IA transforme les processus d'achat public en offrant des gains de temps et d'efficacité.",
            "body": "L'intelligence artificielle révolutionne les achats publics. Elle permet d'analyser des données massives pour prévoir les besoins et identifier les meilleures offres. L'automatisation libère du temps pour des tâches stratégiques, générant des économies significatives et une transparence accrue.",
            "date": "2024-11-01",
            "image": {
               "url": "https://img.freepik.com/photos-premium/banniere-nature-forestiere-ai-generative_73944-31146.jpg"
            },
            "images": [
               {
                  "url": "https://img.freepik.com/photos-premium/banniere-nature-forestiere-ai-generative_73944-31146.jpg"
               },
               {
                  "url": "https://st3.depositphotos.com/2189145/17529/i/450/depositphotos_175291112-stock-photo-hilly-field-beautiful-sky-hilly.jpg"
               }
            ]
         }
       ]
 ```
---
## Screenshots
![picture](./src/main/resources/images/importContentFromJson.png)
---

## Configuration

### Path Settings
- The base path is pre-set to `/sites/{siteKey}/contents`.
- Users can specify a subpath in the UI, but the base path remains immutable.

### Content Type
- Available content types and their properties are fetched via GraphQL.
- Only fields matching the content type properties are imported.

---

## GraphQL Queries and Mutations

### Fetch Content Types
```graphql
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
```

### Fetch Properties for Selected Content Type
```graphql
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
```

### Create Content Folder
```graphql
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
```

### Create Content Node
```graphql
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
```

---

## Error Handling

1. **Invalid JSON**
    - Displays an error message if the uploaded file is not a valid JSON.
2. **Path Issues**
    - Attempts to create the path if it doesn’t exist.
    - Reports errors if path creation fails.
3. **Existing Nodes**
    - Skips nodes that already exist and logs them in the error report.
4. **Property Validation**
    - Ignores fields in the JSON that don’t match the selected content type properties.

---

## Customization

- **Field Mapping**: Extend or modify the `processJsonData` function to handle additional JSON fields.
- **Styles**: Update `ImportContent.component.scss` to customize the UI design.
- **Localization**: Add translations for new languages in the resource bundle files.

---

## License

This project is licensed under the MIT License.

---

## Additional Notes

- Ensure the JSON file adheres to the structure required by the selected content type.
- Use the sample JSON preview to verify file content before importing.
- For advanced configurations, consult the module documentation or support team.



