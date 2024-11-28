import PropTypes from 'prop-types';

export const FieldPropTypes = PropTypes.shape({
    name: PropTypes.string,
    displayName: PropTypes.string.isRequired,
    multiple: PropTypes.bool,
    i18n: PropTypes.bool,
    selectorType: PropTypes.string,
    mandatory: PropTypes.bool,
    readOnly: PropTypes.bool,
    requiredType: PropTypes.string
});
