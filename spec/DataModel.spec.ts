import {DataModel, EdmMapping, DataContext, SchemaLoaderStrategy} from '../index';
import { TestApplication } from './TestApplication';
import { resolve } from 'path';
import {SqliteAdapter} from '@themost/sqlite';
import * as listener from './test1/listeners/Employee.beforeUpgrade';

class Employee {
    public EmployeeID?: number;
    public LastName?: string;
    public FirstName?: string;
    public BirthDate?: Date;
    public Photo?: string;
    public Notes?: string;
}
@EdmMapping.entityType('Employee')
class EmployeeModel {
    public EmployeeID?: number;
    public LastName?: string;
    public FirstName?: string;
    public BirthDate?: Date;
    public Photo?: string;
    public Notes?: string;
}

describe('DataModel', () => {
    let app: TestApplication;
    let context: DataContext;
    beforeAll((done) => {
        app = new TestApplication(resolve(__dirname, 'test1'));
        return done();
    });
    beforeEach((done) => {
        context = app.createContext();
        return done();
    });
    afterEach((done) => {
        if (context) {
            return context.finalize(() => {
                return done();
            });
        }
        return done();
    });
    afterAll(async () => {
        await app.finalize();
    });
    it('should get model', () => {
        let model = context.model('Employee');
        expect(model).toBeTruthy();
        // load by class
        model = context.model(Employee);
        expect(model).toBeTruthy();
        expect(model.name).toBe('Employee');
        model = context.model(EmployeeModel);
        expect(model).toBeTruthy();
        expect(model.name).toBe('Employee');
    });

    it('should get items', async () => {
        // load by class
        let model = context.model(Employee);
        const items = await model.getItems();
        expect(items.length).toBeGreaterThan(0);
    });

    it('should get item', async () => {
        // load by class
        let item: Employee = await context.model(Employee).where('EmployeeID').equal(1).getItem();
        expect(item).toBeTruthy();
        expect(item.EmployeeID).toBe(1);
    });

    it('should use migrateAsync', async () => {
        const db = context.db as SqliteAdapter;
        let exists = await db.table('OtherProducts').existsAsync();
        expect(exists).toBeFalsy();
        const upgraded = await context.model('OtherProduct').migrateAsync();
        expect(upgraded).toBeTruthy();
        exists = await db.table('OtherProducts').existsAsync();
        expect(exists).toBeTruthy();
        const configuration: any = app.getConfiguration();
        const version = context.model('OtherProduct').version;
        expect(configuration.cache.OtherProduct).toEqual({
            version
        });
    });

    it('should use load event', async () => {
        DataModel.load.subscribeOnce((event) => {
            event.target.caching = 'always';
        });
        let model = context.model('Employee');
        expect(model.caching).toBe('always');
        model = context.model('Employee');
        expect(model.caching).toBe('none');
    });

    it('should clone model', () => {
        const model = context.model('Employee').silent();
        expect(model).toBeTruthy();
        const cloned = model.clone();
        expect(cloned instanceof DataModel);
        expect(cloned.name).toEqual(model.name);
        // change something to parent
        model.caching = 'always';
        expect(cloned.caching).not.toBe(model.caching);
        expect(cloned.isSilent()).toBeTruthy();
    });

    it('should use beforeUpgrade', async () => {
        const schema: SchemaLoaderStrategy = context.getConfiguration().getStrategy(SchemaLoaderStrategy);
        const modelDefinition = schema.getModelDefinition('Employee')
        modelDefinition.eventListeners = modelDefinition.eventListeners || [];
        modelDefinition.eventListeners.push({
            type: resolve(__dirname, 'test1', 'listeners', 'Employee.beforeUpgrade')
        });
        schema.setModelDefinition(modelDefinition);
        const model = context.model('Employee');
        const listeners = model.listeners('before.upgrade');
        expect(listeners).toBeTruthy();
        expect(listeners.length).toBeGreaterThan(0);
        const [beforeUpgradeListener] = listeners;
        expect(beforeUpgradeListener).toBeTruthy();
        expect(beforeUpgradeListener).toBe(listener.beforeUpgrade);
    });

});

