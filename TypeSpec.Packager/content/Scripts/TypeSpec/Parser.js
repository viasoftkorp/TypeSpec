(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", './Keyword', './RegEx', './State'], function (require, exports) {
    var Keyword_1 = require('./Keyword');
    var RegEx_1 = require('./RegEx');
    var State_1 = require('./State');
    var FeatureParser = (function () {
        function FeatureParser(steps, testReporter, tagsToExclude) {
            this.steps = steps;
            this.testReporter = testReporter;
            this.tagsToExclude = tagsToExclude;
            this.tags = [];
            this.state = [];
            this.scenarioIndex = 0;
            this.currentCondition = '';
            this.asyncTimeout = 1000;
            this.state[this.scenarioIndex] = new State_1.InitializedState(this.tagsToExclude);
        }
        FeatureParser.prototype.process = function (line) {
            if (this.state[this.scenarioIndex].isNewScenario(line)) {
                var existingFeatureTitle = this.state[this.scenarioIndex].featureTitle;
                var existingFeatureDescription = this.state[this.scenarioIndex].featureDescription;
                this.scenarioIndex++;
                this.state[this.scenarioIndex] = new State_1.FeatureState(null);
                this.state[this.scenarioIndex].featureTitle = existingFeatureTitle;
                this.state[this.scenarioIndex].featureDescription = existingFeatureDescription;
                this.state[this.scenarioIndex].tagsToExclude = this.tagsToExclude;
            }
            this.state[this.scenarioIndex] = this.state[this.scenarioIndex].process(line);
        };
        FeatureParser.prototype.run = function () {
            for (var scenarioIndex = 0; scenarioIndex < this.state.length; scenarioIndex++) {
                var scenario = this.state[scenarioIndex];
                if (typeof scenario.scenarioTitle === 'undefined') {
                    this.testReporter.information(scenario.featureTitle + ' has an ignored scenario, or a scenario missing a title.');
                    continue;
                }
                this.runScenario(scenario);
            }
        };
        FeatureParser.prototype.runScenario = function (scenario) {
            var tableRowCount = (scenario.tableRows.length > 0) ? scenario.tableRows.length : 1;
            for (var exampleIndex = 0; exampleIndex < tableRowCount; exampleIndex++) {
                try {
                    var passed = true;
                    var i;
                    var context = {};
                    this.testReporter.information('--------------------------------------');
                    this.testReporter.information(Keyword_1.Keyword.Feature);
                    this.testReporter.information(scenario.featureTitle);
                    this.testReporter.information('\t' + scenario.featureDescription.join('\r\n\t') + '\r\n\r\n');
                    var conditions = scenario.getAllConditions();
                    this.runNextCondition(conditions, 0, context, scenario, exampleIndex, true);
                }
                catch (ex) {
                    passed = false;
                    this.testReporter.error(scenario.featureTitle, this.currentCondition, ex);
                }
            }
        };
        FeatureParser.prototype.runNextCondition = function (conditions, conditionIndex, context, scenario, exampleIndex, passing) {
            var _this = this;
            try {
                var next = conditions[conditionIndex];
                var i = conditionIndex + 1;
                this.currentCondition = next.condition;
                context.done = function () {
                    if (_this.asyncTimer) {
                        clearTimeout(_this.asyncTimer);
                    }
                    if (i < conditions.length) {
                        _this.runNextCondition(conditions, i, context, scenario, exampleIndex, passing);
                    }
                    else {
                        _this.testReporter.summary(scenario.featureTitle, scenario.scenarioTitle, passing);
                    }
                };
                var condition = scenario.prepareCondition(next.condition, exampleIndex);
                this.testReporter.information('\t' + condition);
                var stepExecution = this.steps.find(condition, next.type);
                var isAsync = stepExecution.isAsync;
                if (stepExecution === null) {
                    var stepMethodBuilder = new StepMethodBuilder(condition);
                    throw new Error('No step definition defined.\n\n' + stepMethodBuilder.getSuggestedStepMethod());
                }
                if (stepExecution.parameters) {
                    stepExecution.parameters.unshift(context);
                    stepExecution.method.apply(null, stepExecution.parameters);
                }
                else {
                    stepExecution.method.call(null, context);
                }
                if (isAsync) {
                    this.asyncTimer = setTimeout(function () {
                        _this.testReporter.error('Async Exception', condition, new Error('Async step timed out'));
                        _this.runNextCondition(conditions, i, context, scenario, exampleIndex, false);
                    }, this.asyncTimeout);
                }
                else {
                    context.done();
                }
            }
            catch (ex) {
                passing = false;
                this.testReporter.error(scenario.featureTitle, this.currentCondition, ex);
                this.testReporter.summary(scenario.featureTitle, scenario.scenarioTitle, passing);
            }
        };
        return FeatureParser;
    })();
    exports.FeatureParser = FeatureParser;
    var StepMethodBuilder = (function () {
        function StepMethodBuilder(originalCondition) {
            this.originalCondition = originalCondition;
        }
        StepMethodBuilder.prototype.getSuggestedStepMethod = function () {
            var argumentParser = new ArgumentParser(this.originalCondition);
            var params = argumentParser.getParameters();
            var comma = (params.length > 0) ? ', ' : '';
            var suggestion = '    runner.addStep(/' + argumentParser.getCondition() + '/i,\n' +
                '        (context: any' + comma + params + ') => {\n' +
                '            throw new Error(\'Not implemented.\');\n' +
                '        });';
            return suggestion;
        };
        return StepMethodBuilder;
    })();
    var ArgumentParser = (function () {
        function ArgumentParser(originalCondition) {
            this.originalCondition = originalCondition;
            this.arguments = [];
            this.condition = originalCondition;
            this.parseArguments();
        }
        ArgumentParser.prototype.getCondition = function () {
            return this.condition;
        };
        ArgumentParser.prototype.getParameters = function () {
            return this.arguments.join(', ');
        };
        ArgumentParser.prototype.parseArguments = function () {
            var foundArguments = this.originalCondition.match(RegEx_1.ExpressionLibrary.quotedArgumentsRegExp);
            if (foundArguments && foundArguments.length > 0) {
                for (var i = 0; i < foundArguments.length; i++) {
                    var foundArgument = foundArguments[i];
                    this.processFoundArgument(foundArgument, i);
                }
            }
        };
        ArgumentParser.prototype.processFoundArgument = function (quotedArgument, position) {
            var trimmedArgument = quotedArgument.replace(/"/g, '');
            var argumentExpression = null;
            if (trimmedArgument.toLowerCase() === 'true' || trimmedArgument.toLowerCase() === 'false') {
                this.arguments.push('p' + position + ': boolean');
                argumentExpression = RegEx_1.ExpressionLibrary.trueFalseString;
            }
            else if (parseFloat(trimmedArgument).toString() === trimmedArgument) {
                this.arguments.push('p' + position + ': number');
                argumentExpression = RegEx_1.ExpressionLibrary.numberString;
            }
            else {
                this.arguments.push('p' + position + ': string');
                argumentExpression = RegEx_1.ExpressionLibrary.defaultString;
            }
            this.condition = this.condition.replace(quotedArgument, argumentExpression);
        };
        return ArgumentParser;
    })();
});
