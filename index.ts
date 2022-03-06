import fs from 'fs';
import chalk from 'chalk';
import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);

socket(server);

app.use(bodyParser.json());

const log = console.log;

let data: Record<string, Array<any>> = {};

app.get('/', (req, res) => {
	res.send(`<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta http-equiv="X-UA-Compatible" content="IE=edge">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>RediDB default page</title>
		<style>
			@import url('https://fonts.googleapis.com/css2?family=Open+Sans&display=swap');
	
			* {
				margin: 0;
			}
	
			body {
				background-color: #222;
				color: white;
				text-align: center;
				height: 100vh;
				width: 100vw;
				max-height: 100vh;
				max-width: 100vw;
				display: grid;
				place-items: center;
				font-family: 'Open Sans', Helvetica, sans-serif;
			}
	
			hr {
				opacity: 75%;
			}
	
			a {
				color: white;
				opacity: 1;
			}
	
			a:hover {
				opacity: .5;
			}
			
		</style>
	</head>
	<body>
		<div>
			<h1>RediDB default page</h1>
			<br>
			<br>
			<p>This is the default page of the RediDB database. You found it!</p>
			<br>
			<hr>
			<br>
			<p>If you see this you've set up the database correctly. GG!</p>
			<br>
			<hr>
			<br>
			<p>Please look at <a href="https://r07.dev/db" target="_blank" ref="noopener noreferrer">the Documentation</a> and change user and password, if not changed yet.</p>
		</div>
	</body>
	</html>`);
});

initDb();

// Reading Database
async function readDatabase() {
	return await JSON.parse(
		await fs.readFileSync('./data/data.json', { encoding: 'utf8' })
	);
}

// Writing stuff to Database
async function writeToDatabase(data: Record<string, unknown>) {
	try {
		await fs.writeFileSync('./data/data.json', JSON.stringify(data));
	} catch (e) {
		await fs.mkdirSync('./data');
	}
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

server.listen({ port: process.env.PORT }, () => {
	log(chalk.blue('[WEB]: Started!'));
});

function socket(server: http.Server) {
	const io = new Server(server);
	io.on('connection', socket => {
		socket.once('auth', m => {
			if (m.password === process.env.PASSWORD && m.user === process.env.USER) {
				socket.emit('alert', 'CONNECTED SUCCESSFULLY!');
			} else {
				socket.emit('alert', 'Auth failure.');
				socket.disconnect();
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

				socket.emit('createDatabase', 'success');
			});

			socket.on('add', m => {
				const { database, data: inp } = m;
				if (!data[database] && !Array.isArray(data[database])) {
					socket.emit('add', 'No such DB');
					return;
				}

				data[database].push(inp);
				socket.emit('add', 'success');
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

				socket.emit('edit', 'success');
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

				socket.emit('add', 'success');
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
