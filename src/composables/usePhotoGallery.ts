import {onMounted, ref, watch} from 'vue';
import {Camera, CameraResultType, CameraSource, Photo} from "@capacitor/camera";
import {Directory, Filesystem} from "@capacitor/filesystem";
import {Preferences} from "@capacitor/preferences";
import {isPlatform} from "@ionic/vue";
import {Capacitor} from "@capacitor/core";

export const usePhotoGallery = () => {
    const PHOTO_STORAGE = 'photos'
    const photos = ref<UserPhoto[]>([])

    const cachePhotos = () => {
        Preferences.set({
            key: PHOTO_STORAGE,
            value: JSON.stringify(photos.value)
        })
    }

    const convertToBase64 = (blob: Blob) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader()

            reader.onerror = reject
            reader.onload = () => {
                resolve(reader.result)
            }
            reader.readAsDataURL(blob)
        })

    const savePicture = async (photo: Photo, filename: string) => {
        let base64Data: string

        if(isPlatform('hybrid')) {
            const file = await Filesystem.readFile({
                path: photo.path!,
            })
            base64Data = file.data as string
        } else {
            const response = await fetch(photo.webPath!)
            const blob = await response.blob()
            base64Data = (await convertToBase64(blob)) as string
        }

        const savedFile = await Filesystem.writeFile({
            path: filename,
            data: base64Data,
            directory: Directory.Data
        })

        if(isPlatform('hybrid')) {
            return {
                filepath: savedFile.uri,
                webviewPath: Capacitor.convertFileSrc(savedFile.uri)
            }
        }

        return {
            filepath: filename,
            webviewPath: photo.webPath
        }
    }

    const takePhoto = async () => {
        const photo = await Camera.getPhoto({
            resultType: CameraResultType.Uri,
            source: CameraSource.Camera,
            quality: 100
        })

        const filename = `${Date.now()}.jpeg`
        const savedFileImage = await savePicture(photo, filename)
        photos.value = [savedFileImage, ...photos.value]
    }

    const loadSaved = async () => {
        const photoList = await Preferences.get({key: PHOTO_STORAGE})
        const photosInPreferences = photoList.value ? JSON.parse(photoList.value) : []

        if (!isPlatform('hybrid')) {
            for (const photo of photosInPreferences) {
                const file = await Filesystem.readFile({
                    path: photo.filepath,
                    directory: Directory.Data
                })
                photo.webviewPath = `data:image/jpeg;base64,${file.data}`
            }

            photos.value = photosInPreferences
        }

        photos.value = photosInPreferences
    }

    const deletePhoto = async (photo: UserPhoto) => {
        photos.value = photos.value.filter(photoSaved =>
            photoSaved.filepath !== photo.filepath)

        const filename = photo.filepath.substr(photo.filepath.lastIndexOf('/') + 1)
        await Filesystem.deleteFile({
            path: filename,
            directory: Directory.Data
        })
    }

    watch(photos, cachePhotos)

    onMounted(loadSaved)

    return {
        photos,
        takePhoto,
        deletePhoto
    }
}

export interface UserPhoto {
    filepath: string;
    webviewPath?: string;
}