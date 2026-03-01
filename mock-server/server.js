const jsonServer = require('json-server')
const path = require('path')

const server = jsonServer.create()
const router = jsonServer.router(path.join(__dirname, 'db.json'))
const middlewares = jsonServer.defaults()
const rewriter = jsonServer.rewriter({
  '/api/*': '/$1',
})

// Default middlewares (logger, static, cors, no-cache)
server.use(middlewares)

// Rewrite /api/* to root so BASE_URL=http://localhost:3000/api works
server.use(rewriter)

server.use(router)

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Mock API running at http://localhost:${PORT}/api`)
})

