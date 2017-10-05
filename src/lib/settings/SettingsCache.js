const Gateway = require('./Gateway');
const GatewaySQL = require('./GatewaySQL');
const SettingResolver = require('../parsers/SettingResolver');

/**
 * Gateway's driver to make new instances of it, with the purpose to handle different databases simultaneously.
 */
class SettingsCache {

	/**
	 * @param {KlasaClient} client The Klasa client
	 */
	constructor(client) {
		/**
		 * The client this SettingsCache was created with.
		 * @type {KlasaClient}
		 * @readonly
		 */
		Object.defineProperty(this, 'client', { value: client });

		/**
		 * The resolver instance this Gateway uses to parse the data.
		 * @type {SettingResolver}
		 */
		this.resolver = new SettingResolver(client);

		/**
		 * All the types accepted for the Gateway.
		 * @type {string[]}
		 */
		this.types = Object.getOwnPropertyNames(SettingResolver.prototype).slice(1);
	}

	/**
	 * Add a new instance of SettingGateway, with its own validateFunction and schema.
	 * @param {string} name The name for the new instance.
	 * @param {Function} validateFunction The function that validates the input.
	 * @param {Object} [schema={}] The schema.
	 * @param {string} [options={}] A provider to use. If not specified it'll use the one in the client.
	 * @returns {Gateway}
	 * @example
	 * // Add a new SettingGateway instance, called 'users', which input takes users, and stores a quote which is a string between 2 and 140 characters.
	 * const validate = async function(resolver, user) {
	 *	 const result = await resolver.user(user);
	 *	 if (!result) throw 'The parameter <User> expects either a User ID or a User Object.';
	 *	 return result;
	 * };
	 * const schema = {
	 *	 quote: {
	 *		 type: 'String',
	 *		 default: null,
	 *		 array: false,
	 *		 min: 2,
	 *		 max: 140,
	 *	 },
	 * };
	 * SettingsCache.add('users', validate, schema);
	 */
	async add(name, validateFunction, schema = {}, options = {}) {
		if (typeof name !== 'string') throw 'You must pass a name for your new gateway and it must be a string.';
		if (typeof this[name] !== 'undefined') throw 'There is already a Gateway with that name.';
		if (typeof validateFunction !== 'function') throw 'You must pass a validate function.';
		validateFunction = validateFunction.bind(null, this.resolver);
		if (schema.constructor.name !== 'Object') throw 'Schema must be a valid object or left undefined for an empty object.';

		options.provider = this._checkProvider(options.provider || this.client.config.provider.engine || 'json');
		if (options.provider.cache) throw `The provider ${options.provider.name} is designed for caching, not persistent data. Please try again with another.`;
		options.cache = this._checkProvider(options.cache || this.client.config.provider.cache || 'collection');
		if (options.cache.cache === false) throw `The provider ${options.cache.name} is designed for persistent data, not cache. Please try again with another.`;

		if (options.provider.sql) this[name] = new GatewaySQL(this, name, validateFunction, schema, options);
		else this[name] = new Gateway(this, name, validateFunction, schema, options);

		await this[name].init();
		return this[name];
	}

	_checkProvider(engine) {
		const provider = this.client.providers.get(engine);
		if (!provider) throw `This provider (${engine}) does not exist in your system.`;

		return provider;
	}

	/**
	 * The validator function Klasa uses for guild settings.
	 * @param {SettingResolver} resolver The resolver instance this Gateway uses to parse the data.
	 * @param {(Object|string)} guild The data to validate.
	 * @returns {any}
	 */
	async validate(resolver, guild) { // eslint-disable-line class-methods-use-this
		const result = await resolver.guild(guild);
		if (!result) throw 'The parameter <Guild> expects either a Guild ID or a Guild Object.';
		return result;
	}

	/**
	 * The data schema Klasa uses for guild settings.
	 * @readonly
	 * @returns {Object}
	 */
	get defaultDataSchema() {
		return {
			prefix: {
				type: 'String',
				default: this.client.config.prefix,
				array: this.client.config.prefix.constructor.name === 'Array',
				sql: `TEXT NOT NULL DEFAULT '${this.client.config.prefix.constructor.name === 'Array' ? JSON.stringify(this.client.config.prefix) : this.client.config.prefix}'`
			},
			language: {
				type: 'String',
				default: this.client.config.language,
				array: false,
				sql: `TEXT NOT NULL DEFAULT '${this.client.config.language}'`
			},
			disabledCommands: {
				type: 'Command',
				default: [],
				array: true,
				sql: 'TEXT DEFAULT \'[]\''
			}
		};
	}

}

module.exports = SettingsCache;
