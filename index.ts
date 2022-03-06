import fs from 'fs';
import chalk from 'chalk';
import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const server = http.createServer(app);

socket(server);

app.use(bodyParser.json());

const log = console.log;

let data: Record<string, Array<any>> = {};

app.get('/', (req, res) => {
	res.sendFile(`${__dirname}\\views\\default.html`);
});

initDb();

// Reading Database
async function readDatabase() {
	return await JSON.parse(
		await fs.readFileSync('./data.json', { encoding: 'utf8' })
	);
}

// Writing stuff to Database
async function writeToDatabase(data: Record<string, unknown>) {
	await fs.writeFileSync('./data.json', JSON.stringify(data));
}

// Initializing Database
async function initDb() {
	try {
		data = await readDatabase();
	} catch (err) {
		await writeToDatabase(data);
	}

	setInterval(async () => {
		await writeToDatabase(data);
	}, 2000);

	log(chalk.green('[REDIDB]: Database initialized!'));
	log('DATA', data);
}

server.listen({ host: process.env.HOST, port: process.env.PORT }, () => {
	log(chalk.blue('[WEB]: Started!'));
});

function socket(server: http.Server) {
	const io = new Server(server);
	io.on('connection', socket => {
		console.log('CONNECTED A SOCKET!');
		socket.once('auth', m => {
			if (m.password === process.env.PASSWORD && m.user === process.env.USER) {
				socket.emit('alert', 'CONNECTED SUCCESSFULLY!');
				console.log('SOCKET AUTHORIZED!');
			} else {
				socket.emit('alert', 'Auth failure.');
				socket.disconnect();
				console.log('SOCKET UNAUTHORIZED!');
				return;
			}

			socket.on('get', m => {
				if (data[m.database]) socket.emit('get', m.database);
				else socket.emit('get', 'No such DB');

				socket.emit('get', data[m.database]);
			});

			socket.on('query', m => {
				const { database, query } = m;
				if (!data[database]) {
					socket.emit('query', 'No such DB');
					return;
				}

				if (!query) {
					socket.emit(
						'query',
						'No query provided! If you want to get the whole db, use get instead.'
					);
					return;
				}

				socket.emit('query', queryDB(data[database], query));
			});

			socket.on('createDatabase', m => {
				const { database } = m;
				if (data[database]) {
					socket.emit('createDatabase', 'Database already exists!');
					return;
				}
				data[database] = [];
			});

			socket.on('add', m => {
				const { database, data: inp } = m;
				if (!data[database] && !Array.isArray(data[database])) {
					socket.emit('add', 'No such DB');
					return;
				}

				data[database].push(inp);
			});

			socket.on('edit', m => {
				const { database, query, data: inp } = m;

				if (!data[database] && !Array.isArray(data[database])) {
					socket.emit('edit', 'No such DB');
					return;
				}

				if (!query) {
					socket.emit('edit', 'No query!');
					return;
				}

				if (!inp) {
					socket.emit('edit', 'No new data!');
					return;
				}

				const toChange = queryDB(data[database], query);

				toChange.forEach(e => {
					Object.keys(inp).forEach(k => {
						data[database][data[database].indexOf(e)][k] = inp[k];
					});
				});
			});

			socket.on('delete', m => {
				const { database, query } = m;

				if (!data[database] && !Array.isArray(data[database])) {
					socket.emit('delete', 'No such DB');
					return;
				}

				if (!query) {
					socket.emit('delete', 'No query!');
					return;
				}

				const toDelete = queryDB(data[database], query);

				toDelete.forEach(e => {
					const i = data[database].indexOf(e);
					if (i > -1) data[database].splice(i, 1);
				});
			});
		});
	});
}

function queryDB(database: Array<any>, query: Record<string, unknown>) {
	return database.filter(e => {
		let match = true;

		Object.keys(query).forEach(k => {
			if (!(e[k] === query[k])) {
				match = false;
			}
		});

		return match;
	});
}
