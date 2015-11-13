﻿import * as TsUnit from './Scripts/tsUnit/tsUnit';
import * as TypeSpec from './Scripts/TypeSpec/TypeSpec';

class Calculator {
    private total = 0;

    add(n: number) {
        this.total += n;
    }

    getTotal() {
        return this.total;
    }
}

// TODO: per-test state - if calculator wasn't initialized in the first step, there would be indeterminate tests
var calculator: Calculator = new Calculator();;


var runner = new TypeSpec.SpecRunner();

runner.addStep(/I have entered (\d+) into the calculator/i, /\d+/, (numberToAdd: string) => {
    var num = parseFloat(numberToAdd);
    calculator.add(num);
});

runner.addStep(/I press add/gi, null, () => {
    // No action needed
});

runner.addStep(/the result should be (\d+) on the screen/i, /\d+/, (numberForTotal: string) => {
    // TODO: use tsUnit / other library assertions
    var num = parseFloat(numberForTotal);
    var total = calculator.getTotal();

    // TODO: test state to remove need to clean up
    calculator = new Calculator();

    if (total !== num) {
        throw Error('Total should have been ' + num + ', was ' + total);
    }
});

runner.run(
    '/Specifications/Basic.html',
    '/Specifications/Failing.html',
    '/Specifications/MissingStep.html'
);