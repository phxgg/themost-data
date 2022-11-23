const {Args, DataError} = require('@themost/common');
const {hasOwnProperty} = require('./has-own-property');
const {QueryEntity, QueryExpression, QueryField} = require('@themost/query');
class DataFieldQueryResolver {
    /**
     * @param {import("./data-model").DataModel} target
     */
    constructor(target) {
        this.target = target;
    }

    /**
     *
     * @param {string} value
     * @returns {string}
     */
    formatName(value) {
        if (/^\$/.test(value)) {
            return value.replace(/(\$?(\w+)?)/g, '$2').replace(/\.(\w+)/g, '.$1')
        }
        return value;
    }

    /**
     * @param {import("./types").DataField} field
     * @returns {{$select?: import("@themost/query").QueryField, $expand?: import("@themost/query").QueryEntity[]}|null}
     */
    resolve(field) {
        Args.check(field != null, new DataError('E_FIELD','Field may not be null', null, this.target.name));
        if (Array.isArray(field.query) === false) {
            return {
                select: null,
                expand: []
            };
        }
        let expand = [];
        let select = null;
        for (const stage of field.query) {
            if (stage.$lookup) {
                // get from model
                const from = stage.$lookup.from;
                const fromModel = this.target.context.model(from);
                if (stage.$lookup.pipeline && stage.$lookup.pipeline.length) {
                    
                    const self = this;
                    stage.$lookup.pipeline.forEach(function(pipelineStage) {
                        if (pipelineStage.$match && pipelineStage.$match.$expr) {
                            const q = new QueryExpression().select('*').from(self.target.sourceAdapter);
                            // get expression as string
                            const exprString = JSON.stringify(pipelineStage.$match.$expr);
                            // and parse $$field expression
                            const finalExpr = exprString.replace(/("\$\$(\w+)")/g, function(replaceValue) {
                                let localField = /\$\$(\w+)/.exec(replaceValue)[1];
                                let localFieldAttribute = self.target.getAttribute(localField);
                                if (localFieldAttribute && localFieldAttribute.model === self.target.name) {
                                    return `{"$name":"${self.target.sourceAdapter}.${localField}"}`;
                                }
                                // get base model
                                const baseModel = self.target.base();
                                if (baseModel) {
                                    localFieldAttribute = baseModel.getAttribute(localField);
                                    if (localFieldAttribute) {
                                        return `{"$name":"${baseModel.viewAdapter}.${localField}"}`;
                                    }
                                }
                                throw new DataError('E_FIELD', 'Data field cannot be found', null, self.target.name, localField);
                             }).replace(/"\$((\w+)(\.(\w+)){1,})"/g, '{ "$name": "$1" }');
                             const joinCollection = new QueryEntity(fromModel.viewAdapter).as(stage.$lookup.as).left();
                             Object.defineProperty(joinCollection, 'model', {
                                 configurable: true,
                                 enumerable: false,
                                 writable: true,
                                 value: fromModel.name
                             });
                             const joinExpression = Object.assign(new QueryExpression(), {
                                $where: JSON.parse(finalExpr)
                             });
                            q.join(joinCollection).with(joinExpression);
                            const appendExpand = [].concat(q.$expand);
                            expand.push.apply(expand, appendExpand);
                        }
                    });
                } else {
                    let localField = this.formatName(stage.$lookup.localField);
                    if (/\./g.test(localField) === false) {
                        // get local field expression
                        let localFieldAttribute = this.target.getAttribute(localField);
                        if (localFieldAttribute && localFieldAttribute.model === this.target.name) {
                            localField = `${this.target.sourceAdapter}.${localField}`;
                        } else {
                            // get base model
                            const baseModel = this.target.base();
                            if (baseModel) {
                                localFieldAttribute = baseModel.getAttribute(localField);
                                if (localFieldAttribute) {
                                    localField = `${baseModel.viewAdapter}.${localField}`;
                                }
                            }
                        }
                    }
                    const foreignField = this.formatName(stage.$lookup.foreignField);
                    const q = new QueryExpression().select('*').from(this.target.sourceAdapter);
                    Args.check(fromModel != null, new DataError('E_MODEL', 'Data model cannot be found', null, from));
                    const joinCollection = new QueryEntity(fromModel.viewAdapter).as(stage.$lookup.as).left();
                    Object.defineProperty(joinCollection, 'model', {
                        configurable: true,
                        enumerable: false,
                        writable: true,
                        value: fromModel.name
                    });
                    q.join(joinCollection).with(
                        new QueryExpression().where(new QueryField(localField))
                            .equal(new QueryField(foreignField).from(stage.$lookup.as))
                    );
                    const appendExpand = [].concat(q.$expand);
                    expand.push.apply(expand, appendExpand);
                }
            }
            const name = field.property || field.name;
            if (stage.$project) {
                Args.check(hasOwnProperty(stage.$project, name), new DataError('E_QUERY', 'Field projection expression is missing.', null, this.target.name, field.name));
                const expr = Object.getOwnPropertyDescriptor(stage.$project, name).value;
                if (typeof expr === 'string') {
                    select = new QueryField(this.formatName(expr)).as(name)
                } else {
                    const expr1 = Object.defineProperty({}, name, {
                        configurable: true,
                        enumerable: true,
                        writable: true,
                        value: expr
                    });
                    // Important note: Field references e.g. $customer.email
                    // are not supported by @themost/query@Formatter
                    // and should be replaced by name references e.g. { "$name": "customer.email" }
                    // A workaround is being used here is a regular expression replacer which 
                    // will try to replace  "$customer.email" with { "$name": "customer.email" }
                    // but this operation is definitely a feature request for @themost/query
                    const finalExpr = JSON.parse(JSON.stringify(expr1).replace(/"\$((\w+)(\.(\w+)){1,})"/g, '{ "$name": "$1" }'));
                    select = Object.assign(new QueryField(), finalExpr);
                }
            }
        }
        return {
            $select: select,
            $expand: expand
        }
    }

}

module.exports = {
    DataFieldQueryResolver
}
