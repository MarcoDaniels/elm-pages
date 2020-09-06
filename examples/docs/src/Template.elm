module Template exposing (..)

import Global
import GlobalMetadata
import Head
import Pages
import Pages.PagePath exposing (PagePath)
import Pages.StaticHttp as StaticHttp


simplest :
    { view :
        List ( PagePath Pages.PathKey, GlobalMetadata.Metadata )
        -> StaticPayload templateMetadata ()
        -> Global.RenderedBody
        -> Global.PageView templateMsg
    , head :
        StaticPayload templateMetadata ()
        -> List (Head.Tag Pages.PathKey)
    }
    -> Template templateMetadata () () templateMsg
simplest config =
    template
        { view =
            \dynamicPayload allMetadata staticPayload rendered ->
                config.view allMetadata staticPayload rendered
        , head = config.head
        , staticData = \_ -> StaticHttp.succeed ()
        , init = \_ -> ( (), Cmd.none )
        , update = \_ _ _ -> ( (), Cmd.none, Global.NoOp )
        }


simpler :
    { view :
        List ( PagePath Pages.PathKey, GlobalMetadata.Metadata )
        -> StaticPayload templateMetadata ()
        -> templateModel
        -> Global.RenderedBody
        -> Global.PageView templateMsg
    , head :
        StaticPayload templateMetadata ()
        -> List (Head.Tag Pages.PathKey)
    , init : templateMetadata -> ( templateModel, Cmd templateMsg )
    , update : templateMetadata -> templateMsg -> templateModel -> ( templateModel, Cmd templateMsg )
    }
    -> Template templateMetadata () templateModel templateMsg
simpler config =
    template
        { view =
            \dynamicPayload allMetadata staticPayload rendered ->
                config.view allMetadata staticPayload dynamicPayload.model rendered
        , head = config.head
        , staticData = \_ -> StaticHttp.succeed ()
        , init = config.init
        , update = \a1 b1 c1 -> config.update a1 b1 c1 |> (\( a, b ) -> ( a, b, Global.NoOp ))
        }


stateless :
    { staticData :
        List ( PagePath Pages.PathKey, GlobalMetadata.Metadata )
        -> StaticHttp.Request templateStaticData
    , view :
        List ( PagePath Pages.PathKey, GlobalMetadata.Metadata )
        -> StaticPayload templateMetadata templateStaticData
        -> Global.RenderedBody
        -> Global.PageView templateMsg
    , head :
        StaticPayload templateMetadata templateStaticData
        -> List (Head.Tag Pages.PathKey)
    }
    -> Template templateMetadata templateStaticData () templateMsg
stateless config =
    template
        { view =
            \dynamicPayload allMetadata staticPayload rendered ->
                config.view allMetadata staticPayload rendered
        , head = config.head
        , staticData = config.staticData
        , init = \_ -> ( (), Cmd.none )
        , update = \_ _ _ -> ( (), Cmd.none, Global.NoOp )
        }


template :
    { staticData :
        List ( PagePath Pages.PathKey, GlobalMetadata.Metadata )
        -> StaticHttp.Request templateStaticData
    , view :
        DynamicPayload templateModel
        -> List ( PagePath Pages.PathKey, GlobalMetadata.Metadata )
        -> StaticPayload templateMetadata templateStaticData
        -> Global.RenderedBody
        -> Global.PageView templateMsg
    , head :
        StaticPayload templateMetadata templateStaticData
        -> List (Head.Tag Pages.PathKey)
    , init : templateMetadata -> ( templateModel, Cmd templateMsg )
    , update : templateMetadata -> templateMsg -> templateModel -> ( templateModel, Cmd templateMsg, Global.GlobalMsg )
    }
    -> Template templateMetadata templateStaticData templateModel templateMsg
template config =
    { view = config.view
    , head = config.head
    , staticData = config.staticData
    , init = config.init
    , update = config.update
    }


type alias Template templateMetadata templateStaticData templateModel templateMsg =
    { staticData :
        List ( PagePath Pages.PathKey, GlobalMetadata.Metadata )
        -> StaticHttp.Request templateStaticData
    , view :
        DynamicPayload templateModel
        -> List ( PagePath Pages.PathKey, GlobalMetadata.Metadata )
        -> StaticPayload templateMetadata templateStaticData
        -> Global.RenderedBody
        -> Global.PageView templateMsg
    , head :
        StaticPayload templateMetadata templateStaticData
        -> List (Head.Tag Pages.PathKey)
    , init : templateMetadata -> ( templateModel, Cmd templateMsg )
    , update : templateMetadata -> templateMsg -> templateModel -> ( templateModel, Cmd templateMsg, Global.GlobalMsg )
    }


type alias StaticPayload metadata staticData =
    { static : staticData
    , globalStatic : Global.StaticData
    , metadata : metadata
    , path : PagePath Pages.PathKey
    }


type alias DynamicPayload model =
    { model : model
    , globalModel : Global.Model
    }
