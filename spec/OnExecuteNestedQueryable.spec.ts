import { DataApplication } from '../data-application';
import { resolve } from 'path';
import { TraceUtils } from '@themost/common';
import { DataConfigurationStrategy } from '../data-configuration';
import { OnExecuteNestedQueryable } from '../OnExecuteNestedQueryable';
import { TestUtils } from './adapter/TestUtils';
import { TestApplication2 } from './TestApplication';
import { DataContext } from 'types';

describe('OnExecuteNestedQueryable', () => {
    let app: TestApplication2;
    let context: DataContext;
    beforeAll((done) => {
        app = new TestApplication2();
        context = app.createContext();
        return done();
    });
    afterAll(async () => {
        await context.finalizeAsync();
        await app.finalize();
    })
    it('should find listener', () => {
        expect(app).toBeTruthy();
        const model = context.model('Product');
        expect(model).toBeTruthy();
        let listeners = model.rawListeners('before.execute');
        const beforeExecute = OnExecuteNestedQueryable.prototype.beforeExecute;
        let listener = listeners.find((item) => {
            return item === beforeExecute;
        });
        expect(listener).toBeTruthy();
        model.removeListener('before.execute', beforeExecute);
        listeners = model.rawListeners('before.execute');
        listener = listeners.find((item) => {
            return item === beforeExecute;
        });
        expect(listener).toBeFalsy();
    });

    it('should use nested query', async () => {
        let Actions = context.model('Action');
        const beforeExecute = OnExecuteNestedQueryable.prototype.beforeExecute;
        Actions.removeListener('before.execute', beforeExecute);
        await expect(Actions.where('actionStatus/alternateName')
            .equal('CompletedActionStatus').silent().getItems()).rejects.toBeTruthy();
        Actions = context.model('Action');
        await expect(Actions.where('actionStatus/alternateName').equal('CompletedActionStatus').silent().getItems())
            .resolves.toBeTruthy();
    });

    it('should use nested many-to-one query', async () => {
        let Orders = context.model('Order');
        await expect(Orders.where('customer/gender/alternateName')
        .equal('Female').silent().getItems()).resolves.toBeTruthy();
    });

    it('should use nested one-to-many query', async () => {
        let People = context.model('Person');
        await expect(People.where('orders/orderStatus/alternateName')
            .equal('OrderProblem').silent().getItems()).resolves.toBeTruthy();
    });

});