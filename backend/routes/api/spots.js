const express = require('express')
const router = express.Router();

const { check } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');
const { requireAuth } = require('../../utils/auth');
const { Op } = require('sequelize');

const { Spot, SpotImage, User, Booking, Review, ReviewImage, sequelize } = require('../../db/models');
const { ResultWithContext } = require('express-validator/src/chain');

//GET ALL SPOTS OWNED BY CURRENT USER

router.get('/current', requireAuth, async (req, res, next) => {
    const spots = await Spot.findAll({
        where: {
            ownerId: req.user.id // instance of current user logged in
        },
        include: [{
            model: SpotImage
        },
        {
            model: Review
        }
        ]
    })

    const spotsArr = [];
    spots.forEach(spot => {
        let total = 0
        const spotJSON = spot.toJSON()

        spotJSON.Reviews.forEach(ele => {
            total += ele.stars
        })
        const avg = total / spotJSON.Reviews.length
        spotJSON.avgRating = avg

        // spotJSON.SpotImages.forEach(ele => {
        //     if (ele.preview === true) {
        //         spotJSON.previewImage = ele.url
        //     } else {
        //         spotJSON.previewImage = 'No preview available'
        //     }
        // })

        for (let i = 0; i < spotJSON.SpotImages.length; i++) {
            let ele = spotJSON.SpotImages[i];
            if (ele.preview === true) {
                spotJSON.previewImage = ele.url
            } else {
                spotJSON.previewImage = 'No preview available'
            }
        }

        delete spotJSON.Reviews // deletes Reviews included
        delete spotJSON.SpotImages // deletes SpotImages included
        spotsArr.push(spotJSON)
    })

    return res.json({ Spots: spotsArr })
})

//GET DETAILS FOR A SPOT FROM AN ID
router.get('/:spotId', async (req, res, next) => {
    const spotId = await Spot.findByPk(req.params.spotId, {
        include: [
            {
                model: SpotImage,
                attributes: ['id', 'url', 'preview']
            },
            {
                model: User,
                as: 'Owner',
                attributes: ['id', 'firstName', 'lastName']
            },
            {
                model: Review
            }
        ]
    })

    if (!spotId) {
        res.status(404)
        return res.json({
            message: "Spot couldn't be found"
        })
    }

    const spotJSON = spotId.toJSON()

    const totalCount = await Review.count({ //numReviews
        where: {
            spotId: req.params.spotId
        }
    })

    const starCount = await Review.sum('stars', { //starSum
        where: {
            spotId: req.params.spotId
        }
    })

    spotJSON.numReviews = totalCount

    spotJSON.avgStarRating = starCount / totalCount

    delete spotJSON.Reviews

    return res.json(spotJSON)
})

//CREATE A SPOT

router.post('/', requireAuth, async (req, res, next) => {
    const { address, city, state, country, lat, lng, name, description, price } = req.body

    const error = {
        message: "Bad Request",
        errors: {}
    }

    if (!address) {
        error.errors.address = "Street address is required"
    }

    if (!city) {
        error.errors.city = "City is required"
    }

    if (!state) {
        error.errors.state = "State is required"
    }

    if (!country) {
        error.errors.country = "Country is required"
    }

    if (!lat || typeof lat !== "number") {
        error.errors.lat = "Latitude is not valid"
    }

    if (!lng || typeof lng !== "number") {
        error.errors.lng = "Longitude is not valid"
    }

    if (!name || name.length > 49) {
        error.errors.name = "Name must be less than 50 characters"
    }

    if (!description) {
        error.errors.description = "Description is required"
    }

    if (!price) {
        error.errors.price = "Price per day is required"
    }

    if (Object.keys(error.errors).length) {
        res.status(400)
        return res.json({
            message: error.message,
            errors: error.errors
        })
    }

    const newSpot = await Spot.create({
        ownerId: req.user.id,
        address,
        city,
        state,
        country,
        lat,
        lng,
        name,
        description,
        price
    })

    res.status(201)
    return res.json(newSpot)
})

//ADD AN IMAGE TO A SPOT BASED ON THE SPOT ID

router.post('/:spotId/images', requireAuth, async (req, res, next) => {
    const { url, preview } = req.body
    console.log('this is req body', req.body)
    const user = req.user

    const spotId = await Spot.findByPk(req.params.spotId)

    if (!spotId || spotId.ownerId !== user.id) { // checks if the spotId instance ownderId matches with current user who's logged in
        res.status(404)
        return res.json({
            message: "Spot couldn't be found"
        })
    }

    const newImage = await SpotImage.create({
        url,
        preview
    })

    await spotId.addSpotImage(newImage) // appends image to spot model instance

    // const spotImage = await SpotImage.create({
    //     spotId: +req.params.spotId,
    //     url: url,
    //     preview: preview
    // })

    // console.log('this is spot image', spotImage)
    return res.json({
        url,
        preview: preview
    })
})

//EDIT A SPOT

router.put('/:spotId', requireAuth, async (req, res, next) => {

    const { address, city, state, country, lat, lng, name, description, price } = req.body

    const user = req.user

    const spotId = await Spot.findByPk(req.params.spotId)

    const error = {
        message: "Bad Request",
        errors: {}
    }

    if (!spotId || spotId.ownerId !== user.id) {
        res.status(404)
        return res.json({
            message: "Spot couldn't be found"
        })
    }

    if (!address) {
        error.errors.address = "Street address is required"
    }

    if (!city) {
        error.errors.city = "City is required"
    }

    if (!state) {
        error.errors.state = "State is required"
    }

    if (!country) {
        error.errors.country = "Country is required"
    }

    if (!lat || typeof lat !== "number") {
        error.errors.lat = "Latitude is not valid"
    }

    if (!lng || typeof lng !== "number") {
        error.errors.lng = "Longitude is not valid"
    }

    if (!name || name.length > 49) {
        error.errors.name = "Name must be less than 50 characters"
    }

    if (!description) {
        error.errors.description = "Description is required"
    }

    if (!price) {
        error.errors.price = "Price per day is required"
    }

    if (Object.keys(error.errors).length) {
        res.status(400)
        return res.json({
            message: error.message,
            errors: error.errors
        })
    }

    await spotId.update({
        address,
        city,
        state,
        country,
        lat,
        lng,
        name,
        description,
        price
    })

    // spotId.address = address
    // spotId.city = city
    // spotId.state = state
    // spotId.country = country
    // spotId.lat = lat
    // spotId.lng = lng
    // spotId.name = name
    // spotId.description = description
    // spotId.price = price

    await spotId.save()

    return res.json(spotId)

})

//DELETE A SPOT

router.delete('/:spotId', requireAuth, async (req, res, next) => {

    const user = req.user

    const spotId = await Spot.findByPk(req.params.spotId)

    if (!spotId || spotId.ownerId !== user.id) {
        res.status(404)
        res.json({
            message: "Spot couldn't be found"
        })
    }

    spotId.destroy()

    return res.json({
        message: "Successfully deleted"
    })
})

//GET ALL REVIEWS BY SPOT ID

router.get('/:spotId/reviews', async (req, res, next) => {

    const spotId = await Spot.findByPk(req.params.spotId)

    // SELECT * FROM Reviews WHERE spotId = :spotId
    const spotReview = await Review.findAll({
        where: {
            spotId: req.params.spotId,
        },
        include: [
            {
                model: User,
                attributes: ['id', 'firstName', 'lastName']
            },
            {
                model: ReviewImage,
                attributes: ['id', 'url']
            }
        ]
    })

    if (!spotId) {
        res.status(404)
        res.json({
            message: "Spot couldn't be found"
        })
    }

    return res.json({ Reviews: spotReview })
})

//CREATE A REVIEW FOR A SPOT BASED ON SPOT ID

router.post('/:spotId/reviews', requireAuth, async (req, res, next) => {

    const { review, stars } = req.body
    const user = req.user

    const spotId = await Spot.findByPk(req.params.spotId)

    const error = {
        message: "Bad Request",
        errors: {}
    }

    if (!review) {
        error.errors = "Review text is required"
    }

    if (!stars || Number(stars) < 1 || Number(stars) > 5) {
        error.errors = "Stars must be an integer from 1 to 5"
    }

    if (Object.keys(error.errors).length) {
        res.status(400)
        return res.json({
            message: error.message,
            errors: error.errors
        })
    }

    if (!spotId) {
        res.status(404)
        return res.json({
            message: "Spot couldn't be found"
        })
    }

    const existingReview = await Review.findOne({
        where: {
            userId: user.id, // current user logged in
            spotId: req.params.spotId // spot from param
        }
    })

    if (existingReview) {   //THESE TWO need to exist for this to be truthy
        res.status(500)
        return res.json({
            message: "User already has a review for this spot"
        })
    }

    const newReview = await Review.create({
        userId: user.id,
        spotId: spotId.id,
        review: review,
        stars: stars
    })

    res.status(201)
    return res.json(newReview)
})

//GET ALL BOOKINGS FOR A SPOT BASED ON THE SPOT ID

router.get('/:spotId/bookings', requireAuth, async (req, res, next) => {
    const user = req.user

    const spotId = await Spot.findByPk(req.params.spotId)

    if (!spotId) {
        res.status(404)
        return res.json({
            message: "Spot couldn't be found"
        })
    }

    if (user.id !== spotId.ownerId) {
        const bookings = await Booking.findAll({
            where: {
                spotId: req.params.spotId
            },
            attributes: ['spotId', 'startDate', 'endDate']
        })
        return res.json({ Bookings: bookings })
    } else {
        const bookings = await Booking.findAll({
            where: {
                spotId: req.params.spotId
            },
            include: [{
                model: User,
                attributes: ['id', 'firstName', 'lastName']
            }]
        })
        return res.json({ Bookings: bookings })
    }

})

//CREATE A BOOKING FROM A SPOT BASED ON THE SPOT ID

router.post('/:spotId/bookings', requireAuth, async (req, res, next) => {
    const { startDate, endDate } = req.body
    const user = req.user

    const error = {
        message: "Sorry, this spot is already booked for the specified dates",
        errors: {}
    }

    const spotId = await Spot.findByPk(req.params.spotId)

    //spotId doesn't exist
    if (!spotId || spotId.ownerId === user.id) {
        res.status(404)
        return res.json({
            message: "Spot couldn't be found"
        })
    }

    //if the end date is the same as start date or if end was before start
    if (Date.parse(endDate) === Date.parse(startDate) || Date.parse(endDate) < Date.parse(startDate)) {
        res.status(400)
        return res.json({
            message: "Bad Request",
            errors: {
                endDate: "endDate cannot be on or before startDate"
            }
        })
    }
    //if start and end already exist
    const allBookings = await Booking.findAll({
        where: {
            spotId: req.params.spotId
        }
    })

    const allBookingsArr = []

    allBookings.forEach(ele => {
        allBookingsArr.push(ele.toJSON())
    })

    const startDateObj = new Date(startDate)
    const endDateObj = new Date(endDate)

    allBookingsArr.forEach(ele => {
        const databaseStart = new Date(ele.startDate)
        const databaseEnd = new Date(ele.endDate)

        if (startDateObj.getTime() === databaseStart.getTime() || endDateObj.getTime() === databaseEnd.getTime()) {
            error.errors.startDate = "Start date conflicts with an existing booking",
                error.errors.endDate = "End date conflicts with an existing booking"
        }

        if (startDateObj.getTime() > databaseStart.getTime() && startDateObj.getTime() < databaseEnd.getTime() || endDateObj.getTime() > databaseStart.getTime() && endDateObj.getTime() < databaseEnd.getTime()) {
            error.errors.startDate = "Start date conflicts with an existing booking",
                error.errors.endDate = "End date conflicts with an existing booking"
        }

        if (startDateObj.getTime() > databaseStart.getTime() && endDateObj.getTime() < databaseEnd.getTime()) {
            error.errors.startDate = "Start date conflicts with an existing booking",
                error.errors.endDate = "End date conflicts with an existing booking"
        }

    })

    if (Object.keys(error.errors).length) {
        res.status(403)
        return res.json({
            message: error.message,
            errors: error.errors
        })
    } else {
        const newBooking = await Booking.create({
            spotId: spotId.id,
            userId: user.id,
            startDate: startDate,
            endDate: endDate
        })

        res.status(200)
        return res.json(newBooking)
    }
})

//GET ALL SPOTS

router.get('/', async (req, res, next) => {
    let { page, size, maxLat, minLat, minLng, maxLng, minPrice, maxPrice } = req.query

    page = parseInt(page)   // num
    size = parseInt(size)   // num

    console.log(page, size)

    if (page < 1) {
        res.status(400)
        return res.json({
            message: "Bad Request",
            errors: {
                page: "Page must be greater than or equal to 1",
            }
        })
    }

    if (size < 1) {
        res.status(400)
        return res.json({
            message: "Bad Request",
            errors: {
                size: "Size must be greater than or equal to 1",
            }
        })
    }

    if (!page || page > 10) {
        page = 1
    }

    if (!size || size > 20) {
        size = 20
    }

    let pagination = {}

    if (page >= 1 && size >= 1) {
        pagination.limit = size;
        pagination.offset = size * (page - 1);
    }

    //Queries MAX/MIN LAT/LNG
    const where = {}

    if (maxLat !== undefined) {
        if (Number(maxLat) % 1 === 0) {
            res.status(400)
            return res.json({
                message: "Bad Request",
                errors: "Maximum latitude is invalid"
            })
        } else {
            where.lat = {
                [Op.lte]: Number(maxLat)
            }
        }
    }

    if (minLat !== undefined) {
        if (Number(minLat) % 1 === 0) {
            res.status(400)
            return res.json({
                message: "Bad Request",
                errors: "Minimum latitude is invalid"
            })
        } else {
            where.lat = {
                [Op.gte]: Number(minLat)
            }
        }
    }

    if (minLng !== undefined) {
        if (Number(minLng) % 1 === 0) {
            res.status(400)
            return res.json({
                message: "Bad Request",
                errors: "Minimum latitude is invalid"
            })
        } else {
            where.lng = {
                [Op.gte]: Number(minLng)
            }
        }
    }

    if (maxLng !== undefined) {
        if (Number(maxLng) % 1 === 0) {
            res.status(400)
            return res.json({
                message: "Bad Request",
                errors: "Minimum latitude is invalid"
            })
        } else {
            where.lng = {
                [Op.lte]: Number(maxLng)
            }
        }
    }

    if (minPrice !== undefined) {
        if (Number(minPrice) < 0) {
            return res.json({
                message: "Bad Request",
                errors: "Minimum price must be greater than or equal to 0"
            })
        } else {
            where.price = {
                [Op.gte]: Number(minPrice)
            }
        }
    }

    if (maxPrice !== undefined) {
        if (Number(maxPrice) < 0) {
            return res.json({
                message: "Bad Request",
                errors: "Maximum price must be greater than or equal to 0"
            })
        } else {
            where.price = {
                [Op.lte]: Number(maxPrice)
            }
        }
    }

    const spots = await Spot.findAll({
        where,
        include: [
            {
                model: SpotImage
            },
            {
                model: Review
            }
        ],
        ...pagination
    })

    const spotsArr = [];
    spots.forEach(spot => {
        let total = 0
        const spotJSON = spot.toJSON()

        spotJSON.Reviews.forEach(ele => {
            total += ele.stars
        })
        const avg = total / spotJSON.Reviews.length
        spotJSON.avgRating = avg

        // spotJSON.SpotImages.forEach(ele => {
        //     if (ele.preview === true) {
        //         spotJSON.previewImage = ele.url
        //     } else {
        //         spotJSON.previewImage = 'No preview available'
        //     }
        // })

        for (let i = 0; i < spotJSON.SpotImages.length; i++) {
            let ele = spotJSON.SpotImages[i];
            if (ele.preview === true) {
                spotJSON.previewImage = ele.url
            } else {
                spotJSON.previewImage = 'No preview available'
            }
        }

        delete spotJSON.Reviews // deletes Reviews included
        delete spotJSON.SpotImages // deletes SpotImages included
        spotsArr.push(spotJSON)
    })

    return res.json({ Spots: spotsArr, page, size })
})




module.exports = router
