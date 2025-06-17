import axios from "axios";

export const getLounge = async ({ sessionId }) => {
    return {
        NMIA: "Club Kingston / Norman Manley Intl",
        SIA: "Club Mobay / Sangster Intl",
    };
};

export async function getSchedule({
    direction, airportid, traveldate, flightId, sessionId
}) {

    //const controller = await getOrCreateController(sessionId);

    const request = {
        username: process.env.STATIC_USERNAME,
        sessionid: sessionId,
        failstatus: 0,
        request: {
            direction: direction,
            airportid: airportid,
            traveldate: traveldate,
        },
    };
    try {
        const response = await axios.post(`${process.env.devServer}/getschedule`, request);
        const result = response.data.data.flightschedule.filter((flightDetail) => flightDetail.flightId === flightId);
        return result[0].scheduleId ? "schedule avaialable": "no schedule";
    } catch (error) {
        console.log(error)
    }
    return "we have an error"
}

export async function reserveCart({
    adulttickets,
    childtickets,
    productid,
    sessionId
}) {
    // console.log("hey from reserved Cart")
    const controller = await getOrCreateController(sessionId);
    // console.log('controller from reserver' , controller)
    const scheduleBuilder = {
        arrivalscheduleid: 0,
        departurescheduleid: 0,
    }

    if (productid === "ARRIVALONLY" || productid === "ARRIVALBUNDLE") {
        scheduleBuilder.arrivalscheduleid = controller.bookingSteps.getSchedule.A[0].scheduleId
    }
    if (productid === "DEPARTURELOUNGE" || productid === "ARRIVALBUNDLE") {
        scheduleBuilder.departurescheduleid = controller.bookingSteps.getSchedule.D[0].scheduleId
    }

    // console.log('reservation check' , scheduleBuilder?.departurescheduleid , scheduleBuilder?.arrivalscheduleid)
    const request = {
        failstatus: 0,
        sessionid: controller.bookingSteps.tempSession,
        username: process.env.STATIC_USERNAME,
        request: {
            adulttickets: adulttickets,
            arrivalscheduleid: scheduleBuilder.arrivalscheduleid,
            cartitemid: 0,
            childtickets: childtickets,
            departurescheduleid: scheduleBuilder.departurescheduleid,
            distributorid: "",
            paymenttype: "GUESTCARD",
            productid: productid,
            ticketsrequested: adulttickets + childtickets
        }
    }
    try {
        const response = await axios.post(`${process.env.devServer}/reservecartitem`, request);
        controller.bookingSteps = { ...controller.bookingSteps, getReservation: response.data.data, reservationRequest: request };
        await controller.save();
        return response.data.data;
    } catch (error) {
        console.log(error)
    }
    return "we have an error in reserving cart" 
}

export async function setContact(
    {
        email,
        firstname,
        lastname,
        phone,
        sessionId
    }) {

    const controller = await getOrCreateController(sessionId);
    const reseravationData = controller.bookingSteps["getReservation"];

    const request = {
        failstatus: 0,
        request: {
            contact: {
                cartitemid: reseravationData?.cartitemid,
                email,
                firstname,
                lastname,
                phone,
                title: "MR."
            }
        },
        sessionid: controller.bookingSteps.tempSession,
        username: process.env.STATIC_USERNAME
    }

    try {
        const response = await axios.post(`${process.env.devServer}/setcontact`, request);
        console.log(response.data, "response from Reserve setcontact")
        controller.bookingSteps = { ...controller.bookingSteps, contact: response.data.data.contact }
        controller.save();
        return  "your primary contacts are submitted";
    } catch (error) {
        console.log(error)
    }
    return "we have an error in reserving cart"
}

export async function processPayment({ sessionId, cardHolder,
    cardNumber,
    cardType,
    cvv,
    expiryDate,
    email }) {
    const controller = await getOrCreateController(sessionId);
    try {
        const getOrderRequest = {
            failstatus: 0,
            request: {
                amount: controller.bookingSteps["getReservation"].retail,
                source: "OBI-MAIN",
                sessionid: controller.bookingSteps.tempSession,
                username: process.env.STATIC_USERNAME
            }
        }
        console.log('before get order')
        // getorders
        const getOrderResponse = await axios.post(`${process.env.devServer}/getorderid`, getOrderRequest);

        const confirmatinRequest = {
            "addconfirmation": {
                "failstatus": 0,
                "request": {
                    "affiliateid": "!",
                    "cart": [
                        {
                            "adulttickets": controller?.bookingSteps?.reservationRequest?.adulttickets,
                            "amount": controller?.bookingSteps?.getReservation?.retail,
                            "arrivalscheduleid": controller?.bookingSteps?.getReservation?.arrivalscheduleid,
                            "cartitemid": controller?.bookingSteps?.getReservation?.cartitemid,
                            "childtickets": controller?.bookingSteps?.reservationRequest?.childtickets,
                            "departurescheduleid": controller?.bookingSteps?.getReservation?.arrivalscheduleid,
                            "groupbooking": "N",
                            "groupid": "NA",
                            "infanttickets": 0,
                            "optional": {
                                "specialoccasion": null,
                                "occasioncomment": "",
                                "paddlename": "deafult"
                            },
                            "passengers": [
                                {
                                    // passenger data goes here if available
                                }
                            ],
                            "primarycontact": {
                                "title": "MR",
                                "firstname": controller.bookingSteps.contact.firstname,
                                "lastname": controller.bookingSteps.contact.lastname,
                                "email": controller.bookingSteps.contact.email,
                                "phone": controller.bookingSteps.contact.phone
                            },
                            "productid": controller.bookingSteps.getReservation.productid,
                            "referencenumber": "",
                            "secondarycontact": {
                                "title": "MR",
                                "firstname": "",
                                "lastname": "",
                                "email": "",
                                "phone": ""
                            }
                        }
                    ],
                    "distributorid": "",
                    "httpreferrer": "",
                    "orderid": controller.bookingSteps.getOrderId.orderid,
                    "payment": {
                        "paymenttype": "GUESTCARD",
                        "charged": "Y",
                        "creditcard": {
                            "amount": controller?.bookingSteps?.getReservation?.retail,
                            "authorizationnumber": 123456,
                            cardHolder,
                            cardNumber,
                            cardType,
                            currency: "USD",
                            email,
                        }
                    },
                    "referrerid": "",
                    "sendconfirmation": {
                        "sendto": controller.bookingSteps.contact.email,
                        "copyto": ""
                    },
                    "subaffiliateid": 0,
                    "sessionid": controller.bookingSteps.tempSession,
                    "username": process.env.STATIC_USERNAME
                }
            }
        }
        console.log('after get order')

        const addConfirmationResponse = await axios.post(`${process.env.devServer}/addconfirmationlog`, confirmatinRequest);
        // let encryptedCardDetails = encryptCardDetails({
        //     cardHolder,
        //     cardNumber,
        //     cardType,
        //     cvv,
        //     expiryDate,
        //     email,
        // }, "H@8aAn@eTh)99]B");

        controller.bookingSteps = {...controller.bookingSteps , getOrder:getOrderResponse , confirmationLog : addConfirmationResponse}
        console.log('after log')
        
        await controller.save();
        console.log('after save')

        return "we have succeded till confirmation log";

    } catch (error) {
        console.log(error)
    }

    // const processCardRequest = {
    //     "failstatus": 0,
    //     "request": {
    //         "actiontype": "CHARGECARD",
    //         "creditcard": {
    //             "amount": controller?.bookingSteps?.getReservation?.retail,
    //             "cardholder": encryptedCardDetails.cardHolderName,
    //             "cardnumber": encryptedCardDetails.cardNumber,
    //             "cardtype": "VISA",
    //             "cvv": encryptedCardDetails.cvv,
    //             email,
    //             "expirydate": encryptedCardDetails.expiryDate,
    //             "iv": encryptedCardDetails.iv
    //         },
    //         "orderid": controller.bookingSteps.getOrderId.orderid,
    //         sessionid: controller.bookingSteps.tempSession,
    //         username: process.env.STATIC_USERNAME
    //     }
    // }

    // const processCard = await axios.post(`${process.env.devServer}/processcard`, processCardRequest);


}