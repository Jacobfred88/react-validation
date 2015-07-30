var React = require('react');
var validator = require('validator');
var isObject = require('is-object');
var isArray = require('is-array');
var includes = require('lodash.includes');
var noop = require('lodash.noop');
var objectAssign = require('object-assign');
var classNames = require('classnames');

var errors = {
    defaultMessage: 'validation error',
    defaultInvalidClassName: 'ui-input_state_invalid',
    defaultDisabledClassName: 'ui-button_state_disabled'
};

var Validation = {};

Validation.Form = React.createClass({displayName: "Form",
    componentWillMount: function() {
        this.inputs = {
            submit: [],
            validations: {},
            blocking: {
                inputs: {},
                buttons: []
            }
        };
    },

    componentDidMount: function() {
        this.toggleButtons(this.inputs.submit, this.inputs.validations);
        this.toggleButtons(this.inputs.blocking.buttons, this.inputs.blocking.inputs);
    },

    render: function() {
        return (
            React.createElement("form", {onSubmit: this.props.onSubmit}, 
                this.recursiveCloneChildren(this.props.children)
            )
        );
    },

    validate: function(component) {
        var validations = component.props.validations;
        var state = {
            isValid: true
        };
        var className = {};
        var errorMessage = null;

        className[component.props.className] = true;

        for (var i = 0; i < validations.length; i++) {
            var validation = validations[i];

            if (!validator[validation.rule](component.state.value)) {
                state.isValid = false;
                setErrorState(validation);

                break;
            }
        }

        className = classNames(className);

        if (component.state.isUsed && component.state.isChanged) {
            objectAssign(state, {
                className: className,
                errorMessage: errorMessage
            });
        }

        component.setState(state);

        this.inputs.validations[component.props.name] = state.isValid;
        this.toggleButtons(this.inputs.submit, this.inputs.validations);

        function setErrorState(validation) {
            var hasErrorClassName = errors[validation.rule] && errors[validation.rule].className;
            className[component.props.invalidClassName] = true;
            className[hasErrorClassName ? errors[validation.rule].className : className[errors.defaultInvalidClassName]] = true;
            errorMessage = validation.errorMessage || errors[validation.rule].message || errors.defaultMessage;
        }
    },

    toggleButtons: function(buttons, model) {
        var hasBlocking = this.hasFalsyFlag(model);

        this._setButtonsState(buttons, hasBlocking);
    },

    isValidForm: function() {
        return !this.hasFalsyFlag(this.inputs.validations);
    },

    hasFalsyFlag: function(model) {
        return includes(model, false);
    },

    blocking: function(component) {
        var _this = this;
        var buttons = _this.inputs.blocking.buttons;
        var hasBlocking;

        _this.inputs.blocking.inputs[component.props.name] = Boolean(validator.trim(component.state.value));

        hasBlocking = _this.hasFalsyFlag(_this.inputs.blocking.inputs);

        this._setButtonsState(buttons, hasBlocking);
    },

    _setButtonsState: function(buttons, hasBlocking) {
        var i;

        for (i = 0; i < buttons.length; i++) {
            this.refs[buttons[i]].setState({
                isDisabled: hasBlocking
            });
        }
    },

    recursiveCloneChildren: function(children, index) {
        return React.Children.map(children, function(child, i) {
            var $idx = index || i;

            if (!isObject(child)) {
                return child;
            }

            var childProps = {};
            var shouldValidate = isArray(child.props.validations) && child.props.validations.length;
            var isCheckbox = child.props.type === 'checkbox';
            var value = validator.trim(child.props.value);

            if (isCheckbox && !child.props.checked) {
                value = '';
            }

            if (shouldValidate) {
                childProps.validate = this.validate;
                this.inputs.validations[child.props.name] = Boolean(value);
            }

            if (child.props.type === 'submit') {
                childProps.ref = child.props.ref || child.props.type + $idx;
                $idx++;
                this.inputs.submit.push(childProps.ref);
            }

            if (child.props.blocking === 'input') {
                childProps.blocking = this.blocking;
                this.inputs.blocking.inputs[child.props.name] = Boolean(value);
            }

            if (child.props.blocking === 'button') {
                childProps.ref = childProps.ref || child.props.ref || child.props.blocking + $idx;
                $idx++;
                this.inputs.blocking.buttons.push(childProps.ref);
            }

            childProps.children = this.recursiveCloneChildren(child.props.children, $idx);

            return React.cloneElement(child, childProps);
        }, this);
    }
});

Validation.Input = React.createClass({displayName: "Input",
    propTypes: {
        name: React.PropTypes.string.isRequired,
        type: React.PropTypes.string,
        placeholder: React.PropTypes.oneOfType([
            React.PropTypes.string, React.PropTypes.number
        ])
    },

    getDefaultProps: function() {
        return {
            type: 'text',
            placeholder: 'placeholder',
            className: 'ui-input',
            invalidClassName: errors.defaultInvalidClassName
        }
    },

    // TODO: refactor this method
    getInitialState: function() {
        var value = this.props.value || '';
        this.isCheckbox = this.props.type === 'checkbox';

        if (this.isCheckbox && !this.props.checked) {
            value = '';
        }

        return {
            value: value,
            className: this.props.className || '',
            checked: this.props.checked || false,
            isValid: true,
            isUsed: this.isCheckbox,
            isChanged: this.isCheckbox,
            errorMessage: null
        }
    },

    showError: function(message, additionalClassName) {
        var className = {};

        if (additionalClassName) {
            className[additionalClassName] = true;
        }

        className[this.props.className] = true;
        className[this.props.invalidClassName] = true;

        this.setState({
            isValid: false,
            isUsed: true,
            isChanged: true,
            className: classNames(className),
            errorMessage: message || null
        });
    },

    onChange: function(event) {
        var value = event.currentTarget.value;

        this.setValue(value, event);
    },

    setValue: function(value, event) {
        var isEventPassed = (event && event.nativeEvent instanceof Event);

        if (this.isCheckbox) {
            value = !this.state.checked ? this.props.value : null;
        }

        this.setState({
            isChanged: true,
            isUsed: isEventPassed || !event,
            value: value,
            checked: this.isCheckbox ? !this.state.checked : isEventPassed || !event
        }, function() {
            (this.props.blocking || noop)(this);
            (this.props.validate || noop)(this);
            (this.props.onChange || noop)(isEventPassed ? event : undefined);
        });
    },

    onBlur: function(event) {
        this.setState({
            isUsed: true
        }, function() {
            (this.props.validate || noop)(this);
            (this.props.onBlur || noop)(event);
        });
    },

    render: function() {
        // TODO: rework hint appearance

        return (
            React.createElement("div", null, 
                React.createElement("input", React.__spread({},  this.props, {className: this.state.className, checked: this.state.checked, value: this.state.value, onChange: this.onChange, onBlur: this.onBlur})), 
                React.createElement("span", {className: "ui-input-hint"}, this.state.errorMessage)
            )
        );
    }
});

Validation.Select = React.createClass({displayName: "Select",
    propTypes: {
        name: React.PropTypes.string.isRequired
    },

    getDefaultProps: function() {
        return {
            className: 'ui-select',
            invalidClassName: errors.defaultInvalidClassName
        }
    },

    getInitialState: function() {
        return {
            value: this.props.value || null,
            className: this.props.className || '',
            isUsed: true,
            isChanged: true
        };
    },

    onChange: function(event) {
        var value = event.currentTarget.value;

        this.setValue(value, event);
    },

    setValue: function(value, event) {
        var isEventPassed = (event && event.nativeEvent instanceof Event);

        this.setState({
            value: value
        }, function() {
            (this.props.blocking || noop)(this);
            (this.props.validate || noop)(this);
            (this.props.onChange || noop)(isEventPassed ? event : undefined);
        });
    },

    render: function() {
        return (
            React.createElement("div", null, 
                React.createElement("select", React.__spread({},  this.props, {className: this.state.className, onChange: this.onChange, value: this.state.value}), 
                    this.props.children
                ), 
                React.createElement("span", {className: "ui-input-hint"}, this.state.errorMessage)
            )
        );
    }
});

Validation.Button = React.createClass({displayName: "Button",
    propTypes: {
        type: React.PropTypes.string
    },

    getDefaultProps: function() {
        return {
            type: 'submit',
            className: 'ui-button',
            disabledClassName: errors.defaultDisabledClassName
        }
    },

    getInitialState: function() {
        return {
            isDisabled: true
        }
    },

    render: function() {
        var className = {};
        className[this.props.className] = true;
        className[this.props.disabledClassName] = this.state.isDisabled;
        className = classNames(className);

        // NOTE: Disabled state would be override by passing 'disabled' prop
        return (
            React.createElement("input", React.__spread({disabled: this.state.isDisabled},  this.props, {className: className}))
        );
    }
});

Validation.extendErrors = function(obj) {
    objectAssign(errors, obj);
};

module.exports = Validation;