import Plugin from './Plugin'

export default class Multipart extends Plugin {
  constructor (core, opts) {
    super(core, opts)
    this.type = 'uploader'
    this.id = 'Multipart'
    this.title = 'Multipart'

    // Default options
    const defaultOptions = {
      fieldName: 'files[]',
      responseUrlFieldName: 'url',
      bundle: true
    }

    // Merge default options with the ones set by user
    this.opts = Object.assign({}, defaultOptions, opts)
  }

  upload (file, current, total) {
    this.core.log(`uploading ${current} of ${total}`)
    return new Promise((resolve, reject) => {
      // turn file into an array so we can use bundle
      // if (!this.opts.bundle) {
      //   files = [files[current]]
      // }

      // for (let i in files) {
      //   formPost.append(this.opts.fieldName, files[i])
      // }

      const formPost = new FormData()
      formPost.append(this.opts.fieldName, file.data)

      Object.keys(file.meta).forEach((item) => {
        console.log(file.meta, file.meta[item])
        formPost.append(item, file.meta[item])
      })

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (ev) => {
        if (ev.lengthComputable) {
          // Dispatch progress event
          this.core.emitter.emit('core:upload-progress', {
            uploader: this,
            id: file.id,
            bytesUploaded: ev.loaded,
            bytesTotal: ev.total
          })
        }
      })

      xhr.addEventListener('load', (ev) => {
        if (ev.target.status === 200) {
          const resp = JSON.parse(xhr.response)
          const uploadURL = resp[this.opts.responseUrlFieldName]

          this.core.emitter.emit('core:upload-success', file.id, uploadURL)

          this.core.log(`Download ${file.name} from ${file.uploadURL}`)
          return resolve(file)
        } else {
          this.core.emitter.emit('core:upload-error', file.id, xhr)
          return reject('Upload error')
        }

        // var upload = {}
        //
        // if (this.opts.bundle) {
        //   upload = {files: files}
        // } else {
        //   upload = {file: files[current]}
        // }
      })

      xhr.addEventListener('error', (ev) => {
        this.core.emitter.emit('core:upload-error', file.id)
        return reject('Upload error')
      })

      xhr.open('POST', this.opts.endpoint, true)
      xhr.send(formPost)

      this.core.emitter.on('core:upload-cancel', (fileID) => {
        if (fileID === file.id) {
          xhr.abort()
        }
      })

      this.core.emitter.on('core:cancel-all', () => {
        // const files = this.core.getState().files
        // if (!files[file.id]) return
        xhr.abort()
      })

      this.core.emitter.emit('core:upload-started', file.id)
    })
  }

  selectForUpload (files) {
    if (Object.keys(files).length === 0) {
      this.core.log('no files to upload!')
      return
    }

    const filesForUpload = []
    Object.keys(files).forEach((file) => {
      if (!files[file].progress.uploadStarted || files[file].isRemote) {
        filesForUpload.push(files[file])
      }
    })

    const uploaders = []
    filesForUpload.forEach((file, i) => {
      const current = parseInt(i, 10) + 1
      const total = filesForUpload.length
      uploaders.push(this.upload(file, current, total))
    })

    return Promise.all(uploaders).then((result) => {
      this.core.log('Multipart has finished uploading!')
    })

    //   if (this.opts.bundle) {
    //     uploaders.push(this.upload(files, 0, files.length))
    //   } else {
    //     for (let i in files) {
    //       uploaders.push(this.upload(files, i, files.length))
    //     }
    //   }
  }

  install () {
    const bus = this.core.emitter
    bus.on('core:upload', () => {
      this.core.log('Multipart is uploading...')
      const files = this.core.getState().files
      this.selectForUpload(files)
    })
  }
}
