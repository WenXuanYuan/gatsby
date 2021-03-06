jest.mock(`fs-extra`, () => {
  return {
    ensureDir: jest.fn(() => true),
    writeFile: jest.fn((_f, _b, cb) => cb()),
    stat: jest.fn(() => {
      return {
        isDirectory: jest.fn(),
      }
    }),
  }
})
jest.mock(`../create-file-node`, () => {
  return {
    createFileNode: jest.fn(() => {
      return { internal: {} }
    }),
  }
})

const { ensureDir, writeFile } = require(`fs-extra`)
const { createFileNode } = require(`../create-file-node`)
const createFileNodeFromBuffer = require(`../create-file-node-from-buffer`)

const createMockBuffer = content => {
  const buffer = Buffer.alloc(content.length)
  buffer.write(content)
  return buffer
}

const createMockCache = () => {
  return {
    get: jest.fn(),
    set: jest.fn(),
  }
}

const bufferEq = (b1, b2) => Buffer.compare(b1, b2) === 0

describe(`create-file-node-from-buffer`, () => {
  const defaultArgs = {
    store: {
      getState: jest.fn(() => {
        return {
          program: {
            directory: `__whatever__`,
          },
        }
      }),
    },
    createNode: jest.fn(),
    createNodeId: jest.fn(),
  }

  describe(`functionality`, () => {
    afterEach(() => jest.clearAllMocks())

    const setup = ({
      hash,
      buffer = createMockBuffer(`some binary content`),
      cache = createMockCache(),
    } = {}) =>
      createFileNodeFromBuffer({
        ...defaultArgs,
        buffer,
        hash,
        cache,
      })

    it(`rejects when the buffer can't be read`, () => {
      expect(setup({ buffer: null })).rejects.toEqual(
        expect.stringContaining(`bad buffer`)
      )
    })

    it(`caches the buffer's content locally`, async () => {
      expect.assertions(2)

      let output
      writeFile.mockImplementationOnce((_f, buf, cb) => {
        output = buf
        cb()
      })

      const buffer = createMockBuffer(`buffer-content`)
      await setup({ buffer })

      expect(ensureDir).toBeCalledTimes(2)
      expect(bufferEq(buffer, output)).toBe(true)
    })

    it(`uses cached file Promise for buffer with a matching hash`, async () => {
      expect.assertions(3)

      const cache = createMockCache()

      await setup({ cache, hash: `same-hash` })
      await setup({ cache, hash: `same-hash` })

      expect(cache.get).toBeCalledTimes(1)
      expect(cache.set).toBeCalledTimes(1)
      expect(writeFile).toBeCalledTimes(1)
    })

    it(`uses cached file from previous run with a matching hash`, async () => {
      expect.assertions(3)

      const cache = createMockCache()
      cache.get.mockImplementationOnce(() => `cached-file-path`)

      await setup({ cache, hash: `cached-hash` })

      expect(cache.get).toBeCalledWith(expect.stringContaining(`cached-hash`))
      expect(cache.set).not.toBeCalled()
      expect(createFileNode).toBeCalledWith(
        expect.stringContaining(`cached-file-path`),
        expect.any(Function),
        expect.any(Object)
      )
    })
  })

  describe(`validation`, () => {
    it(`throws on invalid inputs: createNode`, () => {
      expect(() => {
        createFileNodeFromBuffer({
          ...defaultArgs,
          createNode: undefined,
        })
      }).toThrowErrorMatchingInlineSnapshot(
        `"createNode must be a function, was undefined"`
      )
    })

    it(`throws on invalid inputs: createNodeId`, () => {
      expect(() => {
        createFileNodeFromBuffer({
          ...defaultArgs,
          createNodeId: undefined,
        })
      }).toThrowErrorMatchingInlineSnapshot(
        `"createNodeId must be a function, was undefined"`
      )
    })

    it(`throws on invalid inputs: cache`, () => {
      expect(() => {
        createFileNodeFromBuffer({
          ...defaultArgs,
          cache: undefined,
        })
      }).toThrowErrorMatchingInlineSnapshot(
        `"cache must be the Gatsby cache, was undefined"`
      )
    })

    it(`throws on invalid inputs: store`, () => {
      expect(() => {
        createFileNodeFromBuffer({
          ...defaultArgs,
          store: undefined,
        })
      }).toThrowErrorMatchingInlineSnapshot(
        `"store must be the redux store, was undefined"`
      )
    })
  })
})
